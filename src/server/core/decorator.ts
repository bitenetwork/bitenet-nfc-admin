import { TRPCError } from "@trpc/server";
import { Decorator, AppRouterContext } from "./schema";
import { UNEXPECT } from "./error";
import { Prisma } from "@prisma/client";

declare module "~/server/core/schema" {
  interface AppRouterContext {
    txc: TransactionController;
  }
}

export class TransactionController {
  private _tx: Prisma.TransactionClient | undefined;
  private _affterCommitCallbacks: (() => void)[] = [];

  constructor(readonly ctx: AppRouterContext) {}

  set tx(tx: Prisma.TransactionClient | undefined) {
    this._tx = tx;
  }

  get db() {
    return this._tx ?? this.ctx.db;
  }

  set afterCommit(cb: () => void) {
    this._affterCommitCallbacks.push(cb);
  }
  get afterCommit(): (() => void)[] {
    return this._affterCommitCallbacks;
  }

  toCtx() {
    const txc = this;
    return {
      ...txc.ctx,
      txc,
      get db() {
        return txc.db;
      },
    };
  }

  async run(f: () => any) {
    this.afterCommit = () => {
      this.tx = undefined;
    };
    const result = await this.ctx.db.$transaction(
      async (tx) => {
        this.tx = tx;
        return await f();
      },
      { timeout: 120000 },
    );
    this.afterCommit.forEach((cb) => cb());
    return result;
  }
}

const useTransational = (ctx: AppRouterContext) => {
  const txc = ctx.txc ?? new TransactionController(ctx);

  const decorator: Decorator =
    (f) =>
    async (...args: any) =>
      await txc.run(async () => await f(...args));

  const context = txc.toCtx();

  return [decorator, context, txc] as const;
};

const useUnexpectErrorHandled = (ctx: AppRouterContext) => {
  const decorator: Decorator =
    (f) =>
    async (...args: any) => {
      try {
        return await f(...args);
      } catch (e) {
        if (e instanceof TRPCError) {
          throw e;
        }
        ctx.logger.error(
          `unexpected error occur arguments:${JSON.stringify(args)}`,
          e,
        );
        throw UNEXPECT({ cause: e });
      }
    };
  return [decorator, ctx] as const;
};

const decoratorFactory = {
  useTransational,
  useUnexpectErrorHandled,
};

export type DecoratorFactory = typeof decoratorFactory;
export const decorators = decoratorFactory;
