import { WalletAccountOwner, WalletAccountType } from "@prisma/client";
import _ from "lodash";
import { WalletTransationSchema } from "prisma/generated/zod";
import { z } from "zod";
import { UNEXPECT } from "~/server/core/error";
import { asPageable, asPagedResult } from "~/server/core/schema";
import { createTRPCRouter, protectedProcedure } from "~/server/customer/trpc";
import { upScale } from "~/server/service/global-config";
import wallet from "~/server/service/wallet";

const PATH_PREFIX = "/resturant/wallet/points";

// Swagger 接口标签分组定义
export const TAG = "6000 - 餐厅账户 - 代币结余";

export const ResturantWalletPointsRouter = createTRPCRouter({
  getBalance: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/get-balance`,
        tags: [TAG],
        protect: true,
        summary: "获取餐厅代币余额",
      },
    })
    .input(z.void())
    .output(
      z.object({
        balance: z.number().describe("余额"),
      }),
    )
    .query(async ({ ctx }) => {
      const ownerType = WalletAccountOwner.RESTAUARNT;
      const ownerId = ctx.session.brandId;
      if (!ownerId) {
        throw UNEXPECT();
      }

      const { getBalance, getWallet } = wallet(ctx);
      const walletAccount = await getWallet({
        walletType: WalletAccountType.MEMBER_POINTS,
        ownerType,
        ownerId,
      });
      let balance = await getBalance({
        walletType: WalletAccountType.MEMBER_POINTS,
        ownerType,
        ownerId,
      });
      balance = upScale(balance, walletAccount.rounding);
      return { balance };
    }),
  pageTransation: protectedProcedure
    .meta({
      // Swagger 定义
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/page-transation`,
        tags: [TAG],
        protect: true, // 需要鉴权的接口需要加这个属性
        summary: "获取当前餐厅代币交易记录",
      },
    })
    .input(asPageable(z.object({})))
    .output(asPagedResult(WalletTransationSchema))
    .query(async ({ ctx, input: { page, pageSize } }) => {
      const ownerType = WalletAccountOwner.RESTAUARNT;
      const ownerId = ctx.session.brandId;
      if (!ownerId) {
        throw UNEXPECT();
      }

      const { getWallet } = wallet(ctx);
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
        item.amount = upScale(item.amount, walletAccount.rounding);
        item.balanceBefore = upScale(
          item.balanceBefore,
          walletAccount.rounding,
        );
        item.balanceAfter = upScale(item.balanceAfter, walletAccount.rounding);
        if (item.remarkI18n) {
          item.remark = (ctx?.i18n && ctx?.i18n(item.remark)) ?? item.remark;
        }
        if (item.voucherType === "MEMBER_GIFT_EXCHANGE") {
          const memberGiftExchange =
            memberGiftExchangeMap[Number(item.voucher)];
          if (memberGiftExchange) {
            let giftName = memberGiftExchange.exchangeGiftEn_name;
            const lng = _.toLower(ctx.headers["accept-language"] ?? "");
            if (lng === "en") {
              giftName = memberGiftExchange.exchangeGiftEn_name;
            } else if (lng == "zh-hk") {
              giftName = memberGiftExchange.exchangeGiftName;
            } else {
              giftName = memberGiftExchange.exchangeGiftEn_name;
            }
            item.remark = `${giftName}`;
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
