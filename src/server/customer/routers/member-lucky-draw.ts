import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/customer/trpc";
import { asPageable, asPagedResult } from "~/server/core/schema";
import {
  Prisma,
  WalletAccountOwner,
  WalletAccountType,
  MemberGiftExchangeType,
} from "@prisma/client";
import {
  LUCKY_DRAW_NOT_EXISTS_INCORRECT,
  LUCKY_DRAW_PARTICIPATE_IN_ERROR,
  LUCKY_DRAW_DATE_RANGE_INCORRECT,
  GIFT_NOT_EXISTS_INCORRECT,
} from "../error";
import {
  RestaurantSchema,
  MemberSchema,
  MemberLuckyDrawSchema,
} from "prisma/generated/zod";
import wallet from "~/server/service/wallet";
import { UNEXPECT } from "~/server/core/error";

export const TAG = "6002 - 会员 - 会员参与抽奖及记录";

const PATH_PREFIX = "/member-lucky-draw";

const MemberLuckyDrawOutputSchema = MemberLuckyDrawSchema.extend({
  member: MemberSchema.describe("会员信息").nullish(),
  restaurant: RestaurantSchema.describe("餐厅信息").nullish(),
  memberGiftExchangeId: z.number().describe("用户礼物记录Id").nullish(),
});

export const memberLuckyDrawRouter = createTRPCRouter({
  memberParticipateInLuckyDraw: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/participate`,
        tags: [TAG],
        protect: true,
        summary: "会员参与餐厅抽奖活动",
      },
    })
    .input(
      z.object({
        luckyDrawId: z
          .number({ required_error: "member:luckyDrawIdRequired" })
          .describe("抽奖活动Id"),
      }),
    )
    .output(MemberLuckyDrawOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const memberId = ctx.session.userId;

      // 获取抽奖需要花费代币数量的全局配置
      const globalConfig = await ctx.db.globalConfig.findUnique({
        where: { id: 1 },
      });
      if (!globalConfig?.luckyDrawCost) {
        throw UNEXPECT();
      }

      const existLuckyDraw = await ctx.db.luckyDraw.findUnique({
        where: {
          id: input.luckyDrawId,
          isEnabled: true,
        },
      });

      if (!existLuckyDraw) {
        throw LUCKY_DRAW_NOT_EXISTS_INCORRECT();
      }

      // 获取当前日期
      const currentDate = new Date();

      // 检查活动日期范围是否有效（如果 startDate 和 endDate 可以为空）
      if (
        (existLuckyDraw.startDate && existLuckyDraw.startDate >= currentDate) ||
        (existLuckyDraw.endDate && existLuckyDraw.endDate <= currentDate)
      ) {
        throw LUCKY_DRAW_DATE_RANGE_INCORRECT();
      }

      const allLuckyDrawRules = await ctx.db.luckyDrawRule.findMany({
        where: { luckyDrawId: input.luckyDrawId },
      });

      // 新增逻辑：过滤掉剩余数量为0的规则
      const existLuckyDrawRules = allLuckyDrawRules.filter(
        (rule) =>
          (rule.level !== 0 && rule.residueQuantity > 0) || rule.level === 0,
      );

      let totalProbability = new Prisma.Decimal(0);
      for (const rule of existLuckyDrawRules) {
        totalProbability = totalProbability.plus(rule.probability);
      }

      // 计算随机概率
      const randomValue = Math.random();
      let chosenRule = null;

      let accumulatedProbability = new Prisma.Decimal(0);
      for (const rule of existLuckyDrawRules) {
        accumulatedProbability = accumulatedProbability.plus(rule.probability);
        if (
          randomValue <=
          Number(accumulatedProbability.dividedBy(totalProbability))
        ) {
          chosenRule = { ...rule };
          break;
        }
      }

      if (!chosenRule) {
        throw LUCKY_DRAW_PARTICIPATE_IN_ERROR();
      }

      let existGift = null;
      if (chosenRule.giftId > 0) {
        existGift = await ctx.db.gift.findUnique({
          where: { id: chosenRule.giftId },
        });

        if (!existGift) {
          throw GIFT_NOT_EXISTS_INCORRECT;
        }
      }

      const existMember = await ctx.db.member.findUnique({
        where: { id: memberId },
      });

      // 生成抽奖记录
      const memberLuckyDraw = await ctx.db.memberLuckyDraw.create({
        data: {
          createBy: memberId,
          updateBy: memberId,
          memberId: memberId,
          brandId: existLuckyDraw.brandId,
          restaurantId: existLuckyDraw.restaurantId,
          luckyDrawId: input.luckyDrawId,
          luckyDrawName: existLuckyDraw.name,
          luckyDrawEn_name: existLuckyDraw.en_name,
          luckyDrawStartDate: existLuckyDraw.startDate,
          luckyDrawEndDate: existLuckyDraw.endDate,
          luckyDrawDescription: existLuckyDraw.description,
          luckyDrawEn_description: existLuckyDraw.en_description,
          luckyDrawRuleId: chosenRule.id,
          luckyDrawRuleLevel: chosenRule.level,
          luckyDrawRuleTitle: chosenRule.title,
          luckyDrawRuleEn_title: chosenRule.en_title,
          luckyDrawRuleTotalQuantity: chosenRule.totalQuantity,
          luckyDrawRuleQuantity: chosenRule.quantity,
          luckyDrawRuleProbability: chosenRule.probability,
          luckyDrawGiftId: chosenRule.giftId,
          luckyDrawGiftName: existGift ? existGift.name : null,
          luckyDrawGiftEN_name: existGift ? existGift.en_name : null,
          luckyDrawGiftPrice: existGift ? existGift.price : null,
          luckyDrawGiftPhoto: existGift ? existGift.photo : null,
          luckyDrawGiftDescription: existGift ? existGift.description : null,
          luckyDrawGiftEn_description: existGift
            ? existGift.en_description
            : null,
          isSettlement: chosenRule.giftId === 0 ? true : false,
        },
      });

      // 计算剩余数量
      await ctx.db.luckyDrawRule.update({
        where: { id: chosenRule.id },
        data: {
          ...chosenRule,
          residueQuantity:
            chosenRule.level === 0
              ? 0
              : chosenRule.residueQuantity - chosenRule.quantity,
          updateBy: memberId,
        },
      });

      // 从用户代币账户扣除抽奖需要的代币数量
      const { getWallet, transferOut } = wallet(ctx);
      const walletAccount = await getWallet({
        walletType: WalletAccountType.MEMBER_POINTS,
        ownerType: WalletAccountOwner.MEMBER,
        ownerId: memberId,
      });
      await transferOut(
        { account: walletAccount },
        {
          subject: "CONSUME_LUCKY_DRAW",
          amount: globalConfig.luckyDrawCost,
          remark: "wallet:LuckyDrawCost",
          remarkEn: null,
          remarkI18n: true,
          voucherType: "MEMBER_LUCKY_DRAW",
          voucher: String(memberLuckyDraw.id),
        },
      );

      // 保存到礼物兑换记录
      if (memberLuckyDraw.luckyDrawGiftId > 0) {
        await ctx.db.memberGiftExchange.create({
          data: {
            createBy: memberId,
            updateBy: memberId,
            memberId: memberId,
            restaurantId: memberLuckyDraw.restaurantId,
            brandId: memberLuckyDraw.brandId,
            exchangeCost: existGift?.exchangeCost || 0,
            exchangeGiftId: existGift?.id,
            exchangeGiftName: existGift?.name || "",
            exchangeGiftEn_name: existGift?.en_name || "",
            exchangeGiftPrice: existGift?.price,
            exchangeGiftPhoto: existGift?.photo,
            exchangeGiftDescription: existGift?.description,
            exchangeGiftEn_description: existGift?.en_description,
            type: existGift?.type,
            exchangeType: MemberGiftExchangeType.LUCKY_DRAW,
            quantity: memberLuckyDraw.luckyDrawRuleQuantity,
            luckyDrawRecordId: memberLuckyDraw.id,
            isSettlement: false,
          },
        });
      }

      return {
        ...memberLuckyDraw,
        member: existMember,
      };
    }),
  pageMemberLuchyDraw: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/member/page`,
        tags: [TAG],
        protect: true,
        summary: "获取会员抽奖记录分页",
      },
    })
    .input(
      asPageable(
        z.object({
          brandId: z.number().optional().describe("品牌Id"),
          restaurantId: z.number().optional().describe("餐厅Id"),
          luckyDrawName: z.string().optional().describe("抽奖活动名称"),
          luckyDrawEnName: z.string().optional().describe("抽奖活动英文名称"),
          hasGift: z
            .string()
            .optional()
            .describe("是否含有礼物,true 有礼物 false 无礼物"),
        }),
      ),
    )
    .output(asPagedResult(MemberLuckyDrawOutputSchema))
    .query(
      async ({
        ctx,
        input: {
          page,
          pageSize,
          luckyDrawName,
          luckyDrawEnName,
          brandId,
          restaurantId,
          hasGift,
        },
      }) => {
        const memberId = ctx.session.userId;
        const where = {
          memberId: memberId,
          luckyDrawName: { contains: luckyDrawName },
          luckyDrawEn_name: { contains: luckyDrawEnName },
          restaurantId: restaurantId,
          brandId: brandId,
          ...(hasGift !== undefined && {
            luckyDrawRuleLevel: hasGift === "true" ? { not: 0 } : 0,
          }),
        };
        const totalCount = await ctx.db.memberLuckyDraw.count({
          where,
        });
        const pageCount = Math.ceil(totalCount / pageSize);
        if (totalCount === 0) {
          return {
            page,
            pageSize,
            pageCount,
            totalCount,
            record: [],
          };
        }

        const records = await ctx.db.memberLuckyDraw.findMany({
          skip: (page - 1) * pageSize,
          take: pageSize,
          where,
          orderBy: {
            createAt: "desc",
          },
        });

        const existMember = await ctx.db.member.findUnique({
          where: { id: memberId },
        });

        const restaurantMap = new Map();
        if (records.length > 0) {
          const restaurantIds = records.map((item) => item.restaurantId);
          const restaurants = await ctx.db.restaurant.findMany({
            where: { id: { in: restaurantIds } },
          });
          for (const restaurant of restaurants) {
            restaurantMap.set(restaurant.id, restaurant);
          }
        }

        const memberGiftExchangeMap = new Map();
        if (records.length > 0) {
          const luckyDrawIds = records.map((item) => item.id);
          const memberGiftExchanges = await ctx.db.memberGiftExchange.findMany({
            where: { luckyDrawRecordId: { in: luckyDrawIds } },
          });
          for (const memberGiftExchange of memberGiftExchanges) {
            memberGiftExchangeMap.set(memberGiftExchange.luckyDrawRecordId, memberGiftExchange.id);
          }
        }

        return {
          page,
          pageSize,
          pageCount,
          totalCount,
          record: records.map((memberLuckyDraw) => ({
            ...memberLuckyDraw,
            member: existMember,
            restaurant: restaurantMap.get(memberLuckyDraw.restaurantId),
            memberGiftExchangeId: memberGiftExchangeMap.get(memberLuckyDraw.id),
          })),
        };
      },
    ),
});
