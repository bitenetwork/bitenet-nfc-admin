import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import qrcode from "qrcode";
import { env } from "~/env.mjs";
import {
  BrandSchema,
  GiftSchema,
  InviteCodeSchema,
  RestaurantSchema,
} from "prisma/generated/zod";
import {
  Brand,
  Gift,
  InviteCode,
  OperatorType,
  Prisma,
  Restaurant,
} from "@prisma/client";
import { upScale } from "~/server/service/global-config";

const PATH_PREFIX = "/referral/invite-code";

export const TAG = "5000 - 推荐 - 注册邀请码";

export const inviteCodeRouter = createTRPCRouter({
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
    .input(z.void())
    .output(InviteCodeSchema)
    .mutation(async ({ ctx, input }) => {
      const existed = await ctx.db.inviteCode.findFirst({
        where: {
          operatorType: OperatorType.CUSTOMER,
          operatorId: ctx.session.userId,
        },
      });
      if (existed) {
        return existed;
      }

      const code = uuid();
      const base64 = await qrcode.toDataURL(
        `${env.INVITE_CODE_URL}/register?inviteCode=${code}`,
      );

      const inviteCode = await ctx.db.inviteCode.create({
        data: {
          brandId: 0,
          restaurantId: 0,
          operatorType: OperatorType.CUSTOMER,
          operatorId: ctx.session.userId,
          code,
          base64,
          staffName: "",
          remark: "",
        },
      });

      inviteCode.inviteBonus = upScale(inviteCode.inviteBonus, 100);

      return inviteCode;
    }),
  findInviteCode: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/find-invite-code/{code}`,
        tags: [TAG],
        summary: "获取邀请码详情",
      },
    })
    .input(
      z.object({
        code: z.string().describe("邀请码"),
      }),
    )
    .output(
      InviteCodeSchema.extend({
        brand: BrandSchema.nullish(),
        restaurant: RestaurantSchema.nullish(),
        gift: GiftSchema.describe("绑定的礼物").nullish(),
        giftAmount: z.number().describe("绑定的礼物数量").optional(),
      }).nullable(),
    )
    .query(async ({ ctx, input: { code } }) => {
      const inviteCode = (await ctx.db.inviteCode.findUnique({
        where: { code },
      })) as InviteCode & {
        brand?: Brand | null;
        restaurant?: Restaurant | null;
        gift?: Gift | null;
        giftAmount?: number;
      };
      if (!inviteCode) {
        return null;
      }
      const brand = await ctx.db.brand.findUnique({
        where: { id: inviteCode.brandId },
      });
      const restaurant = await ctx.db.restaurant.findUnique({
        where: { id: inviteCode.restaurantId },
      });

      inviteCode.brand = brand;
      inviteCode.restaurant = restaurant;

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
});
