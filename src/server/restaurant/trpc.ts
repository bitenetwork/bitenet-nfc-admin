/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */

import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { CreateNextContextOptions } from "@trpc/server/adapters/next";

import { db } from "~/server/db";
import { redis } from "~/server/redis";
import { IncomingHttpHeaders } from "http";

import { OpenApiMeta } from "trpc-openapi";
import { SessionApp, UserSession, useSession } from "~/server/session";
import initI18N from "~/server/utils/i18next";
import {
  type ErrorOptions,
  defaultErrBuilder,
  setupErrBuilder,
  UNAUTHORIZED,
} from "../core/error";
import { sprintf } from "sprintf-js";
import { v4 as uuid } from "uuid";
import { logger } from "~/server/logger";
import { type AppRouterContext } from "~/server/core/schema";
import { decorators } from "~/server/core/decorator";

const { find: findSession, isValid: isSessionValid } = useSession(
  SessionApp.RESTAURANT,
);

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 */

interface CreateContextOptions {
  headers: IncomingHttpHeaders;
}

/**
 * This helper generates the "internals" for a tRPC context. If you need to use it, you can export
 * it from here.
 *
 * Examples of things you may need it for:
 * - testing, so we don't have to mock Next.js' req/res
 * - tRPC's `createSSGHelpers`, where we don't have req/res
 *
 * @see https://create.t3.gg/en/usage/trpc#-serverapitrpcts
 */
export const createInnerTRPCContext = async ({
  headers,
}: CreateContextOptions) => {
  const requestId = uuid();
  const token = headers.authorization && headers.authorization.split(" ")[1];
  const session = token && (await findSession(token));
  const language = headers["accept-language"];
  const i18n = await initI18N(language);
  const routerLogger = logger.child({ requestId });

  setupErrBuilder(({ message, args, ...options }: ErrorOptions) =>
    defaultErrBuilder({
      ...options,
      message: message && sprintf(i18n(message), ...(args ?? [])),
    }),
  );

  return {
    requestId,
    logger: routerLogger,
    session,
    headers,
    db,
    redis,
    i18n,
    decorators,
  } as AppRouterContext;
};

/**
 * This is the actual context you will use in your router. It will be used to process every request
 * that goes through your tRPC endpoint.
 *
 * @see https://trpc.io/docs/context
 */
export const createTRPCContext = async ({
  req,
  res,
}: CreateNextContextOptions) => {
  // Fetch stuff that depends on the request

  return await createInnerTRPCContext({
    headers: req.headers,
  });
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */

const t = initTRPC
  .context<typeof createTRPCContext>()
  .meta<OpenApiMeta>()
  .create({
    transformer: superjson,
    errorFormatter({ ctx, shape, error }) {
      // trpc-openapi适配器捕捉到 zodError 后强制返回 message=“Input validation failed” 这里改写 name 伪装成非 zodError，才可以返回自定义 message
      // see https://github.com/jlalmes/trpc-openapi/issues/205#issuecomment-1846724926
      const isInputValidationError =
        error.code === "BAD_REQUEST" &&
        error.cause instanceof Error &&
        error.cause.name === "ZodError";
      if (isInputValidationError) {
        error.cause.name = "ZOD_BAD_REQUEST";
      }

      const errMsg =
        error.cause instanceof ZodError
          ? (error.cause as ZodError).issues[0]?.message ?? error.message
          : shape.message;

      return {
        ...shape,
        message: (ctx?.i18n && ctx?.i18n(errMsg)) ?? "",
        data: {
          ...shape.data,
          zodError:
            error.code === "BAD_REQUEST" && error.cause instanceof ZodError
              ? error.cause.flatten()
              : null,
        },
      };
    },
  });

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

const nullToEmpty = t.middleware(async ({ ctx, next }) => {
  const result = await next({ ctx });
  if (result.ok) {
    if (!result.data || result.data === null || result.data === "") {
      result.data = {};
    }
  }
  return result;
});
/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure.use(nullToEmpty);

/** Reusable middleware that enforces users are logged in before running the procedure. */
const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session || !isSessionValid(ctx.session as UserSession)) {
    throw UNAUTHORIZED();
  }
  return next({
    ctx: {
      // infers the `session` as non-nullable
      session: { ...ctx.session },
    },
  });
});

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure
  .use(nullToEmpty)
  .use(enforceUserIsAuthed);
