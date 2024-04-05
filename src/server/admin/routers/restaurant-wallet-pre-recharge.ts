import {
  OperatorType,
  RechargeRecordType,
  WalletAccountOwner,
  WalletAccountType,
} from "@prisma/client";
import Decimal from "decimal.js";
import _ from "lodash";
import { WalletTransationSchema } from "prisma/generated/zod";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/admin/trpc";
import { DATA_NOT_EXIST } from "~/server/core/error";
import { asPageable, asPagedResult } from "~/server/core/schema";
import wallet from "~/server/service/wallet";
import initI18N from "~/server/utils/i18next";

// const i18nEn = await initI18N("en");
export const restaurantWalletPreRechargeRouter = createTRPCRouter({
  getBalance: publicProcedure
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
        walletType: WalletAccountType.RESTAUARNT_PRE_RECHARGE,
        ownerType,
        ownerId,
      });
      let data = await getBalance({
        walletType: WalletAccountType.RESTAUARNT_PRE_RECHARGE,
        ownerType,
        ownerId,
      });
      const amount = new Decimal(data);
      const rounding = new Decimal(walletAccount.rounding);
      const result = amount.div(rounding);
      return result.toNumber();
    }),
  pageTransation: publicProcedure
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
        walletType: WalletAccountType.RESTAUARNT_PRE_RECHARGE,
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

      for (const item of record) {
        const amount = new Decimal(item.amount);
        const rounding = new Decimal(walletAccount.rounding);
        const result = amount.div(rounding);
        item.amount = result.toNumber();
        if (item.remarkI18n) {
          const m = item.remark;
          const i18nZh = await initI18N("zh-hk");
          item.remark = i18nZh(m);
          const i18nEn = await initI18N("en");
          item.remarkEn = i18nEn(m);
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
  deductRecharge: publicProcedure
    .input(
      z.object({
        brandId: z.number(),
        amount: z.number(),
        remark: z.string(),
        remarkEn: z.string(),
      }),
    )
    .mutation(async ({ ctx, input: { brandId, amount, remark, remarkEn } }) => {
      const { getWallet, transferOut } = wallet(ctx);

      const walletAccount = await getWallet({
        walletType: WalletAccountType.RESTAUARNT_PRE_RECHARGE,
        ownerType: WalletAccountOwner.RESTAUARNT,
        ownerId: brandId,
      });

      const roudindAmount = new Decimal(amount).mul(
        new Decimal(walletAccount.rounding),
      );

      const rechargeRecord = await ctx.db.rechargeRecord.create({
        data: {
          recordType: RechargeRecordType.DEDUCT,
          operatorType: OperatorType.ADMIN,
          operatorId: 0,
          brandId,
          amount: roudindAmount.toNumber(),
          rounding: walletAccount.rounding,
          remark,
          remarkEn,
          comfirmed: true,
        },
      });

      await transferOut(
        { account: walletAccount },
        {
          subject: "DEDUCT",
          amount: rechargeRecord.amount,
          remark: rechargeRecord.remark,
          remarkEn: rechargeRecord.remarkEn,
          remarkI18n: false,
          voucherType: "RECHARGE_RECORD",
          voucher: String(rechargeRecord.id),
        },
      );
    }),
  addRecharge: publicProcedure
    .input(
      z.object({
        brandId: z.number(),
        amount: z.number(),
        remark: z.string(),
        remarkEn: z.string(),
      }),
    )
    .mutation(async ({ ctx, input: { brandId, amount, remark, remarkEn } }) => {
      const { getWallet, transferIn } = wallet(ctx);

      const walletAccount = await getWallet({
        walletType: WalletAccountType.RESTAUARNT_PRE_RECHARGE,
        ownerType: WalletAccountOwner.RESTAUARNT,
        ownerId: brandId,
      });

      const roudindAmount = new Decimal(amount).mul(
        new Decimal(walletAccount.rounding),
      );

      const rechargeRecord = await ctx.db.rechargeRecord.create({
        data: {
          recordType: RechargeRecordType.RECHARGE,
          operatorType: OperatorType.ADMIN,
          operatorId: 0,
          brandId,
          amount: roudindAmount.toNumber(),
          rounding: walletAccount.rounding,
          remark,
          remarkEn,
          comfirmed: true,
        },
      });

      await transferIn(
        { account: walletAccount },
        {
          subject: "RECHARGE",
          amount: rechargeRecord.amount,
          remark: rechargeRecord.remark,
          remarkEn: rechargeRecord.remarkEn,
          remarkI18n: false,
          voucherType: "RECHARGE_RECORD",
          voucher: String(rechargeRecord.id),
        },
      );
    }),
  pageRestaurantWalletPreRechargeBalance: publicProcedure
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
          walletType: WalletAccountType.RESTAUARNT_PRE_RECHARGE,
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
