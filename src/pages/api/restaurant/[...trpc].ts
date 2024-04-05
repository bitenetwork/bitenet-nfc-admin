import { NextApiRequest, NextApiResponse } from "next";
import cors from "nextjs-cors";
import { createOpenApiNextHandler } from "trpc-openapi";
import { env } from "~/env.mjs";
import { createTRPCContext as createContext } from "~/server/restaurant/trpc";
import { appRouter as router } from "~/server/restaurant/root";
import { AppRouterContext } from "~/server/core/schema";

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  // Setup CORS
  await cors(req, res);

  // Handle incoming OpenAPI requests
  return createOpenApiNextHandler({
    router,
    createContext,
    responseMeta: (options: { ctx: { requestId: string } }) => ({
      headers: { requestId: options.ctx.requestId },
    }),
    onError: ({
      ctx,
      path,
      error,
    }: {
      ctx: AppRouterContext;
      path: string;
      error: Error;
    }) => {
      ctx.logger.error(`❌ tRPC failed on ${path ?? "<no-path>"}:`, error);
    },
  })(req, res);
};

export default handler;
