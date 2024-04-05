import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/customer/trpc";
import {
  AppRouterContext,
  asPageable,
  asPagedResult,
} from "~/server/core/schema";
import {
  GIFT_NOT_EXISTS_INCORRECT,
  BRAND_NOT_EXISTS_INCORRECT,
  RESTAURANT_NOT_EXISTS_INCORRECT,
  CLOCK_IN_GIFT_NOT_EXISTS_INCORRECT,
  LUCKY_DRAW_GIFT_NOT_EXISTS_INCORRECT,
} from "../error";
import { PARAMETER_ERROR } from "~/server/core/error";
import {
  BrandSchema,
  MemberSchema,
  RestaurantSchema,
  MemberGiftExchangeSchema,
} from "prisma/generated/zod";
import wallet from "~/server/service/wallet";
import {
  Prisma,
  WalletAccountOwner,
  WalletAccountType,
  MemberGiftExchangeType,
} from "@prisma/client";
import { downScale, upScale } from "~/server/service/global-config";

export const TAG = "6004 - 餐厅 - 会员礼物兑换及记录";

const PATH_PREFIX = "/member-gift-exchange";

const MemberGiftExchangeOutputSchema = MemberGiftExchangeSchema.extend({
  member: MemberSchema.describe("会员信息").nullish(),
  brand: BrandSchema.describe("品牌信息").nullish(),
  restaurant: RestaurantSchema.describe("餐厅信息").nullish(),
});

export const memberGiftExchangeRouter = createTRPCRouter({
  memberCommitGiftExchange: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/commit`,
        tags: [TAG],
        protect: true,
        summary: "会员提交礼物兑换",
      },
    })
    .input(
      z.object({
        giftId: z
          .number({ required_error: "member:giftIdRequired" })
          .describe("抽奖活动Id"),
        restaurantId: z
          .number({ required_error: "member:restaurantIdRequired" })
          .describe("餐厅Id"),
      }),
    )
    .output(MemberGiftExchangeOutputSchema)
    .mutation(async ({ ctx: baseCtx, input }) => {
      const [transational, ctx, txc] =
        baseCtx.decorators.useTransational(baseCtx);
      const memberId = ctx.session.userId;
      return await txc.run(async () => {
        const existGift = await ctx.db.gift.findUnique({
          where: { id: input.giftId },
        });

        if (!existGift) {
          throw GIFT_NOT_EXISTS_INCORRECT();
        }

        const existBrand = await ctx.db.brand.findUnique({
          where: { id: existGift.brandId },
        });

        if (!existBrand) {
          throw BRAND_NOT_EXISTS_INCORRECT;
        }

        const existRestaurant = await ctx.db.restaurant.findUnique({
          where: { id: input.restaurantId },
        });

        if (!existRestaurant) {
          throw RESTAURANT_NOT_EXISTS_INCORRECT();
        }

        const existMember = await ctx.db.member.findUnique({
          where: { id: memberId },
        });

        const memberGiftExchange = await ctx.db.memberGiftExchange.create({
          data: {
            createBy: memberId,
            updateBy: memberId,
            memberId: memberId,
            restaurantId: input.restaurantId,
            brandId: existGift.brandId,
            exchangeCost: existGift.exchangeCost ?? 0,
            exchangeGiftId: existGift.id,
            exchangeGiftName: existGift.name,
            exchangeGiftEn_name: existGift.en_name,
            exchangeGiftPrice: existGift.price,
            exchangeGiftPhoto: existGift.photo,
            exchangeGiftDescription: existGift.description,
            exchangeGiftEn_description: existGift.en_description,
            // 兑换礼物自动核销
            isSettlement: true,
          },
        });

        // 扣除会员积分余额，转给餐厅
        const { getWallet, transfer } = wallet(ctx as AppRouterContext);
        const memberWalletAccount = await getWallet({
          walletType: WalletAccountType.MEMBER_POINTS,
          ownerType: WalletAccountOwner.MEMBER,
          ownerId: memberId,
        });
        const brandWalletAccount = await getWallet({
          walletType: WalletAccountType.MEMBER_POINTS,
          ownerType: WalletAccountOwner.RESTAUARNT,
          ownerId: existBrand.id,
        });
        await transfer(
          { account: memberWalletAccount },
          { account: brandWalletAccount },
          {
            subject: "GIFT_EXCHANGE",
            amount: downScale(
              existGift.exchangeCost ?? 0,
              memberWalletAccount.rounding,
            ),
            remark: existGift.name,
            remarkEn: null,
            remarkI18n: false,
            voucherType: "MEMBER_GIFT_EXCHANGE",
            voucher: String(memberGiftExchange.id),
          },
        );

        return {
          ...memberGiftExchange,
          brand: existBrand,
          member: existMember,
          restaurant: existRestaurant,
        };
      });
    }),

  pageMemberGiftExchange: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/page`,
        tags: [TAG],
        protect: true,
        summary:
          "获取当前登陆会员礼物兑换记录分页列表，包含打卡、邀请、抽奖、兑换",
      },
    })
    .input(
      asPageable(
        z.object({
          brandId: z.number().optional().describe("品牌Id"),
          restaurantId: z.number().optional().describe("餐厅Id"),
          giftName: z.string().optional().describe("礼物名称"),
          giftEnName: z.string().optional().describe("礼物英文名称"),
          exchangeType: z
            .nativeEnum(MemberGiftExchangeType)
            .optional()
            .describe("礼物类型"),
        }),
      ),
    )
    .output(asPagedResult(MemberGiftExchangeOutputSchema))
    .query(
      async ({
        ctx,
        input: {
          page,
          pageSize,
          giftName,
          giftEnName,
          brandId,
          restaurantId,
          exchangeType,
        },
      }) => {
        const memberId = ctx.session.userId;

        const where = {
          exchangeType: exchangeType,
          exchangeGiftName: { contains: giftName },
          exchangeGiftEn_name: { contains: giftEnName },
          restaurantId: restaurantId,
          brandId: brandId,
          memberId: memberId,
        };

        const totalCount = await ctx.db.memberGiftExchange.count({ where });
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

        const records = await ctx.db.memberGiftExchange.findMany({
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

        const brandMap = new Map();
        const restaurantMap = new Map();
        if (records.length > 0) {
          const brandIds = records.map((item) => item.brandId);
          const brands = await ctx.db.brand.findMany({
            where: { id: { in: brandIds } },
          });

          for (const brand of brands) {
            brandMap.set(brand.id, brand);
          }

          const restaurantIds = records.map((item) => item.restaurantId);
          const restaurants = await ctx.db.restaurant.findMany({
            where: { id: { in: restaurantIds } },
          });

          for (const restaurant of restaurants) {
            restaurantMap.set(restaurant.id, restaurant);
          }
        }
        return {
          page,
          pageSize,
          pageCount,
          totalCount,
          record: records.map((memberGiftExchange) => ({
            ...memberGiftExchange,
            member: existMember,
            brand: brandMap.get(memberGiftExchange.brandId),
            restaurant: restaurantMap.get(memberGiftExchange.restaurantId),
          })),
        };
      },
    ),
  updateGiftSettlementStatus: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/gift-settlement-status`,
        tags: [TAG],
        protect: true,
        summary: "更新会员抽奖或打卡礼物记录核销状态",
      },
    })
    .input(
      z.object({
        recordType: z
          .enum(["luckyDraw", "clockIn"])
          .describe(
            "类型，'luckyDraw'表示抽奖礼物，'giftExchange'表示打卡礼物",
          ),
        restaurantId: z.number().describe("餐厅Id"),
        recordId: z.number().describe("会员获取礼物记录Id"),
      }),
    )
    .output(z.boolean().describe("是否更新成功"))
    .mutation(
      async ({ input: { recordType, recordId, restaurantId }, ctx }) => {
        const memberId = ctx.session.userId;
        const existLuckyGiftExchange = await ctx.db.memberGiftExchange.findUnique({
                  where: {
                    memberId: memberId,
                    restaurantId: restaurantId,
                    id: recordId,
                  },
                });
        if (!existLuckyGiftExchange || existLuckyGiftExchange.isSettlement) {
              throw LUCKY_DRAW_GIFT_NOT_EXISTS_INCORRECT();
        }
        // 更新兑换记录里面的核销
        const updatedRecord = await ctx.db.memberGiftExchange.update({
          where: { id: existLuckyGiftExchange.id },
          data: { isSettlement: true },
        });

        // 同步更新打卡记录里面的核销
        if (existLuckyGiftExchange.luckyDrawRecordId && MemberGiftExchangeType.LUCKY_DRAW === existLuckyGiftExchange.exchangeType) {
          await ctx.db.memberLuckyDraw.update({
            where: { id: existLuckyGiftExchange.luckyDrawRecordId },
            data: { isSettlement: true },
          });
        }

        return !!updatedRecord;
      },
    ),
});
