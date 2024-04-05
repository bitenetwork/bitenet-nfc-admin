import { GlobalConfigSchema } from "prisma/generated/zod";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/admin/trpc";
import { downScale, findGlobalConfig } from "~/server/service/global-config";

export const globalConfigRouter = createTRPCRouter({
  updateGlobalConfig: protectedProcedure
    .input(
      GlobalConfigSchema.omit({
        createBy: true,
        updateBy: true,
        createAt: true,
        updateAt: true,
        deleteAt: true,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.globalConfig.update({
        data: {
          ...input,
          bonusPointsRangeStart: downScale(input.bonusPointsRangeStart, 100),
          bonusPointsRangeEnd: downScale(input.bonusPointsRangeEnd, 100),
          appSignInBonus: downScale(input.appSignInBonus, 100),
          inviteBonus: downScale(input.inviteBonus, 100),
          pushFeeSms: downScale(input.pushFeeSms, 100),
          pushFeeApp: downScale(input.pushFeeApp, 100),
          luckyDrawCost: downScale(input.luckyDrawCost, 100),
        },
        where: { id: input.id },
      });
    }),
  findGlobalConfig: protectedProcedure
    .input(z.void())
    .output(GlobalConfigSchema.nullable())
    .query(findGlobalConfig),
});
