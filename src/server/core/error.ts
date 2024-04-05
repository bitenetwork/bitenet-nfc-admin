import { TRPCError } from "@trpc/server";
import { TRPC_ERROR_CODE_KEY } from "@trpc/server/rpc";

export interface ErrorOptions {
  message?: string;
  code?: TRPC_ERROR_CODE_KEY;
  cause?: unknown;
  args?: any[];
}

export type ErrBuilder = (opts: ErrorOptions) => Error;

const delegeteErrBuilder = (opts: ErrorOptions) =>
  (customerErrBuilder ?? defaultErrBuilder)(opts);

let customerErrBuilder: ErrBuilder | undefined = undefined;

const createErrorWarpper =
  (builder: ErrBuilder) =>
  (presets: ErrorOptions) =>
  (options: ErrorOptions = {}, ...args: any[]) =>
    builder({
      ...presets,
      ...options,
      args,
    });

export const wrappError = createErrorWarpper(delegeteErrBuilder);

export const UNEXPECT = wrappError({
  code: "INTERNAL_SERVER_ERROR",
  message: "common:UNEXPECT",
});

export const UNAUTHORIZED = wrappError({
  code: "UNAUTHORIZED",
  message: "common:UNAUTHORIZED",
});

export const PARAMETER_ERROR = wrappError({
  code: "PRECONDITION_FAILED",
  message: "common:PARAMETER_ERROR",
});

export const DATA_NOT_EXIST = wrappError({
  code: "NOT_FOUND",
  message: "common:DATA_NOT_EXIST",
});

export function setupErrBuilder(errBuilder: ErrBuilder) {
  customerErrBuilder = errBuilder;
}

export const defaultErrBuilder = (opts: ErrorOptions) =>
  new TRPCError({
    code: opts.code || "INTERNAL_SERVER_ERROR",
    message: opts.message || "common:UNEXPECT",
    cause: opts.cause,
  });
