import { createNextApiHandler } from "@trpc/server/adapters/next";
import { appRouter } from "~/server/admin/root";
import { createTRPCContext } from "~/server/admin/trpc";

const handler = createNextApiHandler({
  router: appRouter,
  createContext: createTRPCContext,
  responseMeta: ({ ctx }) => ({ headers: { requestId: ctx?.requestId || "" } }),
  onError: ({ ctx, path, error }) => {
    ctx?.logger.error(`❌ tRPC failed on ${path ?? "<no-path>"}:`, error);
  },
});

export default handler;
