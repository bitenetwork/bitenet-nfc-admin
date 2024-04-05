import { type inferRouterInputs, type inferRouterOutputs } from "@trpc/server";
import superjson from "superjson";

import { type AppRouter } from "~/server/admin/root";

export const transformer = superjson;

function getBaseUrl() {
  if (typeof window !== "undefined")
    return process.env.NODE_ENV === "production" ? "/api" : "";
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return process.env.BASE_URL;
}

export function getUrl() {
  return getBaseUrl() + "/api/admin/trpc";
}

export function getUploadUrl() {
  return getBaseUrl() + "/api/file";
}

/**
 * Inference helper for inputs.
 *
 * @example type HelloInput = RouterInputs['example']['hello']
 */
export type RouterInputs = inferRouterInputs<AppRouter>;

/**
 * Inference helper for outputs.
 *
 * @example type HelloOutput = RouterOutputs['example']['hello']
 */
export type RouterOutputs = inferRouterOutputs<AppRouter>;
