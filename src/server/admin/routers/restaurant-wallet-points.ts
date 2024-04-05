import { WalletAccountOwner, WalletAccountType } from "@prisma/client";
import Decimal from "decimal.js";
import _ from "lodash";
import { WalletTransationSchema } from "prisma/generated/zod";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/admin/trpc";
import { asPageable, asPagedResult } from "~/server/core/schema";
import wallet from "~/server/service/wallet";

export const restaurantWalletPointsRouter = createTRPCRouter({
  getBalance: protectedProcedure
    .input(
      z.object({
        brandId: z.number().describe("品牌id"),
      }),
    )
    .output(z.number())
    .query(async ({ ctx, input: { brandId } }) => {
      const { getWallet, getBalance } = wallet(ctx);

      const ownerType = WalletAccountOwner.RESTAUARNT;
      const ownerId = brandId;
      const walletAccount = await getWallet({
        walletType: WalletAccountType.MEMBER_POINTS,
        ownerType,
        ownerId,
      });
      let data = await getBalance({
        walletType: WalletAccountType.MEMBER_POINTS,
        ownerType,
        ownerId,
      });
      const amount = new Decimal(data);
      const rounding = new Decimal(walletAccount.rounding);
      const result = amount.div(rounding);
      return result.toNumber();
    }),
  pageTransation: protectedProcedure
    .input(
      asPageable(
        z.object({
          brandId: z.number().describe("品牌id"),
        }),
      ),
    )
    .output(
      asPagedResult(
        WalletTransationSchema.omit({ amount: true }).extend({
          amount: z.number(),
        }),
      ),
    )
    .query(async ({ ctx, input: { page, pageSize, brandId } }) => {
      const { getWallet } = wallet(ctx);
      const ownerType = WalletAccountOwner.RESTAUARNT;
      const ownerId = brandId;
      const walletAccount = await getWallet({
        walletType: WalletAccountType.MEMBER_POINTS,
        ownerType,
        ownerId,
      });
      if (!walletAccount) {
        return {
          page,
          pageSize,
          pageCount: 0,
          totalCount: 0,
          record: [],
        };
      }
      const where = {
        walletAccountId: walletAccount.id,
      };
      const totalCount = await ctx.db.walletTransation.count({ where });
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
      const record = await ctx.db.walletTransation.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        where,
        orderBy: { createAt: "desc" },
      });

      const memberGiftExchangeIds = record
        .filter((x) => x.voucherType === "MEMBER_GIFT_EXCHANGE")
        .map((x) => Number(x.voucher));
      const memberGiftExchanges = _.isEmpty(memberGiftExchangeIds)
        ? []
        : await ctx.db.memberGiftExchange.findMany({
            where: {
              id: {
                in: memberGiftExchangeIds,
              },
            },
          });
      const memberGiftExchangeMap = _.keyBy(memberGiftExchanges, "id");

      for (const item of record) {
        const amount = new Decimal(item.amount);
        const rounding = new Decimal(walletAccount.rounding);
        const result = amount.div(rounding);
        item.amount = result.toNumber();
        if (item.remarkI18n) {
          item.remark = (ctx?.i18n && ctx?.i18n(item.remark)) ?? item.remark;
        }
        if (item.voucherType === "MEMBER_GIFT_EXCHANGE") {
          const memberGiftExchange =
            memberGiftExchangeMap[Number(item.voucher)];
          if (memberGiftExchange) {
            item.remark = `${memberGiftExchange.exchangeGiftEn_name}`;
          }
        }
      }

      return {
        page,
        pageSize,
        pageCount,
        totalCount,
        record,
      };
    }),
  pageRestaurantWalletPointsBalance: protectedProcedure
    .input(
      asPageable(
        z.object({
          name: z.string().optional(),
          restaurantId: z.number().optional(),
        }),
      ),
    )
    .query(async ({ ctx, input: { page, pageSize, name } }) => {
      const where = {
        name: {
          contains: name,
        },
      };
      const totalCount = await ctx.db.brand.count({ where });
      const totalPage = Math.ceil(totalCount / pageSize);
      if (totalCount == 0) {
        return {
          page,
          pageSize,
          totalCount,
          totalPage,
          record: [],
        };
      }

      const record = await ctx.db.brand.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        where,
        orderBy: {
          createAt: "desc",
        },
      });

      const brandIds = record.map((x) => x.id);
      const restaurantList = await ctx.db.restaurant.findMany({
        where: {
          brandId: { in: brandIds },
        },
      });
      const restaurantGrouping = _.groupBy(restaurantList, (x) => x.brandId);

      const balanceList = await ctx.db.walletBalance.findMany({
        where: {
          walletType: WalletAccountType.MEMBER_POINTS,
          ownerType: WalletAccountOwner.RESTAUARNT,
          ownerId: {
            in: brandIds,
          },
        },
      });
      const balanceGrouping = _.groupBy(balanceList, (x) => x.ownerId);

      const resultList = record.map((x) => ({
        ...x,
        restaurant: restaurantGrouping[x.id],
        balance:
          balanceGrouping[x.id]
            ?.filter((y) => y.balanceType == "CONSUMABLE")
            .map((x) =>
              new Decimal(x.balance).div(new Decimal(x.rounding)).toString(),
            )[0] || "0",
      }));

      return {
        page,
        pageSize,
        totalCount,
        totalPage,
        record: resultList,
      };
    }),
});
