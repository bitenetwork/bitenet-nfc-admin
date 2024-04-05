import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/customer/trpc";
import {
  NFC_NOT_EXISTS_INCORRECT,
  NFC_RESTAURANT_EXISTS_INCORRECT,
} from "../error";
import { RestaurantNFCSchema } from "prisma/generated/zod";

const PATH_PREFIX = "/restaurant/nfc";

export const TAG = "2002 - 餐厅 - 餐厅NFT";

const RestaurantNFCInputSchema = z.object({
  photo: z
    .string({ required_error: "restaurant:nfcPhotoRequired" })
    .max(500, "restaurant:nfcPhotoMaxLength")
    .describe("NFT图片"),
  description: z
    .string()
    .max(500, "restaurant:nfcDescriptionMaxLength")
    .describe("NFT描述")
    .nullish(),
  en_description: z
    .string()
    .max(500, "restaurant:nfcEnDescriptionMaxLength")
    .describe("NFT英文描述")
    .nullish(),
  address: z
    .string()
    .max(500, "restaurant:nfcAddressMaxLength")
    .describe("NFT地址")
    .nullish(),
});

export const RestaurantNFCRouter = createTRPCRouter({
  createRestaurantNFC: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/create`,
        tags: [TAG],
        protect: true,
        summary: "创建餐厅NFT信息",
      },
    })
    .input(RestaurantNFCInputSchema)
    .output(z.boolean().describe("是否创建成功,true 成功 false 失败"))
    .mutation(async ({ ctx, input }) => {
      const restaurantId = ctx.session.restaurantId;

      const existRestaurantNFC = await ctx.db.restaurantNFC.findFirst({
        where: {
          restaurantId: restaurantId,
        },
      });
      if (existRestaurantNFC) {
        throw NFC_RESTAURANT_EXISTS_INCORRECT();
      }

      await ctx.db.restaurantNFC.create({
        data: {
          ...input,
          restaurantId: restaurantId,
          createBy: ctx.session.userId,
          updateBy: ctx.session.userId,
        },
      });
      return true;
    }),
  getRestaurantNFCById: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/get/{id}`,
        tags: [TAG],
        protect: true,
        summary: "根据Id获取餐厅NFT详情",
      },
    })
    .input(
      z.object({
        id: z
          .number({ required_error: "restaurant:nfcIdRequired" })
          .describe("餐厅NFTId"),
      }),
    )
    .output(RestaurantNFCSchema)
    .query(async ({ ctx, input: { id } }) => {
      const existRestaurantNFC = await ctx.db.restaurantNFC.findUnique({
        where: { id },
      });
      if (!existRestaurantNFC) {
        throw NFC_NOT_EXISTS_INCORRECT();
      }
      return existRestaurantNFC;
    }),
  deleteRestaurantNFCById: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/delete/{id}`,
        tags: [TAG],
        protect: true,
        summary: "根据Id删除餐厅NFT",
      },
    })
    .input(
      z.object({
        id: z
          .number({ required_error: "restaurant:NFTIdRequired" })
          .describe("餐厅NFTId"),
      }),
    )
    .output(z.boolean().describe("是否删除成功,true 成功 false 失败"))
    .mutation(async ({ ctx, input: { id } }) => {
      const existRestaurantNFC = await ctx.db.restaurantNFC.findUnique({
        where: { id },
      });

      if (!existRestaurantNFC) {
        throw NFC_NOT_EXISTS_INCORRECT();
      }

      await ctx.db.restaurantNFC.delete({
        where: { id },
      });

      return true;
    }),
  updateRestaurantNFCById: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/update/{id}`,
        tags: [TAG],
        protect: true,
        summary: "根据Id更新餐厅NFT",
      },
    })
    .input(
      z.object({
        id: z
          .number({ required_error: "restaurant:nfcIdRequired" })
          .describe("餐厅NFTId"),
        updateData: RestaurantNFCInputSchema,
      }),
    )
    .output(z.boolean().describe("是否更新成功,true 成功 false 失败"))
    .mutation(async ({ ctx, input }) => {
      const existRestaurantNFC = await ctx.db.restaurantNFC.findUnique({
        where: { id: input.id },
      });

      if (!existRestaurantNFC) {
        throw NFC_NOT_EXISTS_INCORRECT;
      }

      await ctx.db.restaurantNFC.update({
        where: { id: input.id },
        data: {
          ...input.updateData,
          updateBy: ctx.session.userId,
        },
      });

      return true;
    }),
  getRestaurantNFC: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/get-by-login`,
        tags: [TAG],
        protect: true,
        summary: "获取当前登陆餐厅品牌餐厅NFT",
      },
    })
    .input(z.void())
    .output(RestaurantNFCSchema.describe("餐厅NFT").nullish())
    .query(async ({ ctx, input }) => {
      const restaurantId = ctx.session.restaurantId;

      const existRestaurantNFC = await ctx.db.restaurantNFC.findFirst({
        where: { restaurantId: restaurantId, deleteAt: 0 },
      });
      return existRestaurantNFC ?? null;
    }),
});
