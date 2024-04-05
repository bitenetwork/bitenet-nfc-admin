import { WalletAccountOwner, WalletAccountType } from "@prisma/client";
import Decimal from "decimal.js";
import _ from "lodash";
import { WalletTransationSchema } from "prisma/generated/zod";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/admin/trpc";
import { asPageable, asPagedResult } from "~/server/core/schema";
import wallet from "~/server/service/wallet";
import initI18N from "~/server/utils/i18next";

export const MemberWalletPointsRouter = createTRPCRouter({
  getBalance: protectedProcedure
    .input(
      z.object({
        memberId: z.number().describe("会员id"),
      }),
    )
    .output(z.number())
    .query(async ({ ctx, input: { memberId } }) => {
      const { getWallet, getBalance } = wallet(ctx);

      const ownerType = WalletAccountOwner.MEMBER;
      const ownerId = memberId;
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
          memberId: z.number().describe("会员id"),
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
    .query(async ({ ctx, input: { page, pageSize, memberId } }) => {
      const { getWallet } = wallet(ctx);
      const ownerType = WalletAccountOwner.MEMBER;
      const ownerId = memberId;
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
          const m = item.remark;
          const i18nZh = await initI18N("zh-hk");
          item.remark = i18nZh(m);
          const i18nEn = await initI18N("en");
          item.remarkEn = i18nEn(m);
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
});
