import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/customer/trpc";
import { LUCKY_DRAW_NOT_EXISTS_INCORRECT } from "../error";
import {
  GiftSchema,
  LuckyDrawSchema,
  LuckyDrawRuleSchema,
} from "prisma/generated/zod";

const PATH_PREFIX = "/lucky-draw";

export const TAG = "6001 - 会员 - 抽奖活动";

const LuckyDrawRuleOutputSchema = LuckyDrawRuleSchema.extend({
  gift: GiftSchema.describe("礼物信息").nullish(),
});

const LuckyDrawOutputSchema = LuckyDrawSchema.extend({
  rules: z.array(LuckyDrawRuleOutputSchema).describe("抽奖规则详情").nullable(),
}).nullish();

export const luckyDrawRouter = createTRPCRouter({
  getRestaurantLuckyDrawByRestaurantId: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/get/{restaurantId}`,
        tags: [TAG],
        protect: true,
        summary: "获取餐厅抽奖活动详情及规则",
      },
    })
    .input(
      z.object({
        restaurantId: z
          .number({ required_error: "member:restaurantIdRequired" })
          .describe("餐厅Id"),
      }),
    )
    .output(LuckyDrawOutputSchema)
    .query(async ({ ctx, input: { restaurantId } }) => {
      const existLuckyDraw = await ctx.db.luckyDraw.findFirst({
        where: { restaurantId: restaurantId, isEnabled: true, deleteAt: 0 },
      });

      if (!existLuckyDraw) {
        return null;
      }

      const existLuckyDrawRules = await ctx.db.luckyDrawRule.findMany({
        where: { luckyDrawId: existLuckyDraw.id },
      });

      const luckyDrawGiftMap = new Map();
      if (existLuckyDrawRules.length > 0) {
        const luckyDrawGiftIds = existLuckyDrawRules.map((item) => item.giftId);
        const luckyDrawGifts = await ctx.db.gift.findMany({
          where: { id: { in: luckyDrawGiftIds } },
        });
        for (const luckyDrawGift of luckyDrawGifts) {
          luckyDrawGiftMap.set(luckyDrawGift.id, luckyDrawGift) || null;
        }
      }

      return {
        ...existLuckyDraw,
        rules: existLuckyDrawRules?.map((rule) => ({
          ...rule,
          gift: luckyDrawGiftMap.get(rule.giftId),
        })),
      };
    }),
});
