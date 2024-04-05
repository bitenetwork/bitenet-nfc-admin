import { Gift, InviteCode, OperatorType } from "@prisma/client";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import moment from "moment";
import qrcode from "qrcode";
import { env } from "~/env.mjs";
import { DATA_NOT_EXIST, UNEXPECT } from "~/server/core/error";
import { asPageable, asPagedResult } from "~/server/core/schema";
import { GiftSchema, InviteCodeSchema } from "prisma/generated/zod";
import { upScale } from "~/server/service/global-config";

const PATH_PREFIX = "/referral/invite-code";

export const TAG = "5000 - 推荐 - 注册邀请码";

export const InviteCodeRouter = createTRPCRouter({
  createInviteCode: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/create-invite-code`,
        tags: [TAG],
        protect: true,
        summary: "创建邀请码",
      },
    })
    .input(
      z.object({
        remark: z.string().optional().describe("备注信息"),
        staffName: z.string().optional().describe("推荐人"),
        expireAt: z.date().optional().describe("过期时间"),
      }),
    )
    .output(InviteCodeSchema)
    .mutation(async ({ ctx, input }) => {
      const brandId = ctx.session.brandId;
      const restaurantId = ctx.session.restaurantId;
      if (!brandId || !restaurantId) {
        throw UNEXPECT();
      }
      const code = uuid();

      const base64 = await qrcode.toDataURL(
        `${env.INVITE_CODE_URL}/register?code=${code}`,
      );

      return await ctx.db.inviteCode.create({
        data: {
          brandId,
          restaurantId,
          operatorType: OperatorType.RESTAUARNT,
          operatorId: ctx.session.userId,
          code,
          base64,
          ...input,
        },
      });
    }),
  deleteInviteCode: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/delete-invite-code/{id}`,
        tags: [TAG],
        protect: true,
        summary: "删除邀请码",
      },
    })
    .input(
      z.object({
        id: z.number().describe("邀请码id"),
      }),
    )
    .output(InviteCodeSchema)
    .mutation(async ({ ctx, input: { id } }) => {
      return await ctx.db.inviteCode.delete({ where: { id } });
    }),
  updateInviteCode: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/update-invite-code/{id}`,
        tags: [TAG],
        protect: true,
        summary: "更新邀请码",
      },
    })
    .input(
      z.object({
        id: z.number().describe("邀请码id"),
        remark: z.string().optional().describe("备注信息"),
        staffName: z.string().optional().describe("推荐人"),
        expireAt: z.date().optional().describe("过期时间"),
        enabled: z.boolean().describe("是否启用：true 是，false 否"),
      }),
    )
    .output(InviteCodeSchema.nullish())
    .mutation(async ({ ctx, input: { id, ...payload } }) => {
      const inviteCode = await ctx.db.inviteCode.findUnique({ where: { id } });
      if (!inviteCode) {
        throw DATA_NOT_EXIST();
      }
      const base64 = await qrcode.toDataURL(
        `${env.INVITE_CODE_URL}?invite-code=${inviteCode.code}`,
      );
      return await ctx.db.inviteCode.update({
        data: { ...payload, base64 },
        where: { id },
      });
    }),
  findInviteCode: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/find-invite-code/{id}`,
        tags: [TAG],
        protect: true,
        summary: "获取邀请码详情",
      },
    })
    .input(
      z.object({
        id: z.number().describe("邀请码id"),
      }),
    )
    .output(
      InviteCodeSchema.extend({
        gift: GiftSchema.describe("绑定的礼物").nullish(),
        giftAmount: z.number().describe("绑定的礼物数量").optional(),
      }).nullable(),
    )
    .query(async ({ ctx, input: { id } }) => {
      const inviteCode = (await ctx.db.inviteCode.findUnique({
        where: { id },
      })) as InviteCode & { gift?: Gift | null; giftAmount?: number };
      if (!inviteCode) {
        return null;
      }
      const inviteGift = await ctx.db.inviteGift.findUnique({
        where: {
          inviteCodeId_deleteAt: { inviteCodeId: inviteCode.id, deleteAt: 0 },
        },
      });
      if (!inviteGift) {
        return inviteCode;
      }
      const gift = await ctx.db.gift.findUnique({
        where: { id: inviteGift.giftId },
      });

      inviteCode.gift = gift;
      inviteCode.giftAmount = inviteGift.giftAmount;

      inviteCode.inviteBonus = upScale(inviteCode.inviteBonus, 100);

      return inviteCode;
    }),
  pageInviteCode: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/page-invite-code`,
        tags: [TAG],
        protect: true,
        summary: "获取邀请码详情",
      },
    })
    .input(
      asPageable(
        z.object({
          enabled: z
            .boolean()
            .optional()
            .describe("是否启用：true 是，false 否"),
        }),
      ),
    )
    .output(
      asPagedResult(
        InviteCodeSchema.extend({
          gift: GiftSchema.describe("绑定的礼物").optional(),
          giftAmount: z.number().describe("绑定的礼物数量").optional(),
        }),
      ),
    )
    .query(async ({ ctx, input: { page, pageSize, enabled } }) => {
      const restaurantId = ctx.session.restaurantId;
      const where = {
        restaurantId,
        enabled,
      };
      const totalCount = await ctx.db.inviteCode.count({ where });
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
      const record = (await ctx.db.inviteCode.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        where,
        orderBy: { createAt: "desc" },
      })) as (InviteCode & { gift?: Gift; giftAmount?: number })[];

      const inviteCodeIds = record.map((x) => x.id);
      const inviteGifts = await ctx.db.inviteGift.findMany({
        where: { inviteCodeId: { in: inviteCodeIds } },
      });
      const inviteGiftMap = Object.fromEntries(
        inviteGifts.map((x) => [x.inviteCodeId, x]),
      );
      const giftIds = inviteGifts.map((x) => x.giftId);
      const gifts = await ctx.db.gift.findMany({
        where: { id: { in: giftIds } },
      });
      const giftMap = Object.fromEntries(gifts.map((x) => [x.id, x]));

      for (const inviteCode of record) {
        const inviteGift = inviteGiftMap[inviteCode.id];
        if (!inviteGift) {
          continue;
        }
        const gift = giftMap[inviteGift.giftId];
        inviteCode.gift = gift;
        inviteCode.giftAmount = inviteGift.giftAmount;
      }

      return {
        page,
        pageSize,
        pageCount,
        totalCount,
        record,
      };
    }),
  bindGift: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/bind-gift`,
        tags: [TAG],
        protect: true,
        summary: "邀请码绑定礼物",
      },
    })
    .input(
      z.object({
        inviteCodeId: z.number().describe("邀请码id"),
        giftId: z.number().describe("礼物id").optional(),
        giftAmount: z.number().describe("礼物数量").optional(),
      }),
    )
    .output(z.void())
    .mutation(async ({ ctx, input: { inviteCodeId, giftId, giftAmount } }) => {
      const inviteCode = await ctx.db.inviteCode.findUnique({
        where: { id: inviteCodeId },
      });
      if (!inviteCode) {
        throw DATA_NOT_EXIST();
      }
      const inviteGift = await ctx.db.inviteGift.findUnique({
        where: { inviteCodeId_deleteAt: { inviteCodeId, deleteAt: 0 } },
      });
      if (inviteGift) {
        await ctx.db.inviteGift.delete({ where: { id: inviteGift.id } });
      }
      if (!giftId) {
        return;
      }
      const gift = await ctx.db.gift.findUnique({
        where: { id: giftId },
      });
      if (!gift || !giftAmount) {
        throw DATA_NOT_EXIST();
      }
      await ctx.db.inviteGift.create({
        data: { inviteCodeId, giftId, giftAmount },
      });
    }),
});
