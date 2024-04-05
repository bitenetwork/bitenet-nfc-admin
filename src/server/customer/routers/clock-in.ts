import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/customer/trpc";
import { CLOCK_IN_NOT_EXISTS_INCORRECT } from "../error";
import {
  GiftSchema,
  ClockInSchema,
  ClockInRuleSchema,
} from "prisma/generated/zod";

const PATH_PREFIX = "/clock-in";

export const TAG = "6007 - 会员 - 打卡活动";

const ClockInRuleOutputSchema = ClockInRuleSchema.extend({
  gift: GiftSchema.describe("礼物信息").nullish(),
});

const ClockInOutputSchema = ClockInSchema.extend({
  rules: z.array(ClockInRuleOutputSchema).describe("打卡规则详情").nullish(),
}).nullish();

export const clockInRouter = createTRPCRouter({
  getClockInByBrandId: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/get/{brandId}`,
        tags: [TAG],
        protect: true,
        summary: "根据Id获取餐厅打卡活动详情及其规则",
      },
    })
    .input(
      z.object({
        brandId: z
          .number({ required_error: "member:brandIdRequired" })
          .describe("品牌Id"),
      }),
    )
    .output(ClockInOutputSchema)
    .query(async ({ ctx, input: { brandId } }) => {
      const existClockIn = await ctx.db.clockIn.findFirst({
        where: { brandId: brandId, isEnabled: true, deleteAt: 0 },
      });
      if (!existClockIn) {
        return null;
      }
      const existClockInRules = await ctx.db.clockInRule.findMany({
        where: { clockInId: existClockIn.id },
      });

      const clockInGiftMap = new Map();
      if (existClockInRules.length > 0) {
        const clockInGiftIds = existClockInRules.map((item) => item.giftId);
        const clockInGifts = await ctx.db.gift.findMany({
          where: { id: { in: clockInGiftIds } },
        });
        for (const clockInGift of clockInGifts) {
          clockInGiftMap.set(clockInGift.id, clockInGift) || null;
        }
      }

      return {
        ...existClockIn,
        rules: existClockInRules?.map((rule) => ({
          ...rule,
          gift: clockInGiftMap.get(rule.giftId),
        })),
      };
    }),
});
