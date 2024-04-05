import { GlobalConfigSchema } from "prisma/generated/zod";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/admin/trpc";
import { findGlobalConfig } from "~/server/service/global-config";

const PATH_PREFIX = "/golbal-config";

export const TAG = "9000 - 全局配置";

export const globalConfigRouter = createTRPCRouter({
  findGlobalConfig: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/find-global-config`,
        tags: [TAG],
        protect: true,
        summary: "获取全局配置",
      },
    })
    .input(z.void())
    .output(GlobalConfigSchema.nullable())
    .query(findGlobalConfig),
});
