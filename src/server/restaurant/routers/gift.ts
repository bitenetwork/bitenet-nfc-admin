import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/customer/trpc";
import {
  GIFT_NAME_EXISTS_INCORRECT,
  GIFT_NOT_EXISTS_INCORRECT,
} from "../error";
import { GiftType } from "@prisma/client";
import { asPageable, asPagedResult } from "~/server/core/schema";
import { GiftSchema } from "prisma/generated/zod";

const PATH_PREFIX = "/gift";

export const TAG = "2003 - 餐厅 - 礼物信息";

const allowedTypes = [GiftType.LUCKY_DRAW, GiftType.SIGN_IN] as const;

const GiftInputSchema = z.object({
  name: z
    .string({ required_error: "restaurant:giftNameRequired" })
    .max(100, "restaurant:giftNameMaxLength")
    .describe("礼物名称"),
  en_name: z
    .string({ required_error: "restaurant:giftEnNameRequired" })
    .max(100, "restaurant:giftEnNameMaxLength")
    .describe("礼物英文名称"),
  type: z
    .nativeEnum(GiftType)
    .refine((value) => allowedTypes.includes(value!), {
      message: "restaurant:giftTypeValueError",
    })
    .nullish()
    .describe("礼物类型, 抽奖 (LUCKY_DRAW) 或 签到 (SIGN_IN)"),
  photo: z
    .string()
    .max(500, "restaurant:giftPhotoMaxLength")
    .nullish()
    .describe("礼物图片"),
  price: z
    .string()
    .max(50, "restaurant:giftPriceMaxLength")
    .nullish()
    .describe("礼物价格"),
  description: z
    .string()
    .max(500, "restaurant:giftDescriptionMaxLength")
    .nullish()
    .describe("礼物描述"),
  en_description: z
    .string()
    .max(500, "restaurant:giftEnDescriptionMaxLength")
    .nullish()
    .describe("礼物英文描述"),
  isExchange: z
    .boolean({ required_error: "restaurant:giftIsExchangeRequired" })
    .describe("是否开启兑换"),
  exchangeCost: z
    .number()
    .min(0, "restaurant:giftExchangeCostMinValue")
    .transform((v) => parseFloat(v.toFixed(2)))
    .optional()
    .describe("兑换所需积分,例如99.99"),
});

export const GiftRouter = createTRPCRouter({
  createGift: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/create`,
        tags: [TAG],
        protect: true,
        summary: "创建礼物",
      },
    })
    .input(GiftInputSchema)
    .output(z.boolean().describe("是否创建成功,true 成功 false 失败"))
    .mutation(async ({ ctx, input }) => {
      const brandId = ctx.session.brandId;

      const existNameGift = await ctx.db.gift.findFirst({
        where: {
          brandId: brandId,
          AND: [
            {
              OR: [{ name: input.name }, { en_name: input.en_name }],
            },
          ],
        },
      });
      if (existNameGift) {
        throw GIFT_NAME_EXISTS_INCORRECT();
      }
      await ctx.db.gift.create({
        data: {
          ...input,
          brandId: brandId,
          createBy: ctx.session.userId,
          updateBy: ctx.session.userId,
        },
      });
      return true;
    }),
  getGiftById: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/get/{id}`,
        tags: [TAG],
        protect: true,
        summary: "根据Id获取礼物详情",
      },
    })
    .input(
      z.object({
        id: z
          .number({ required_error: "restaurant:giftIdRequired" })
          .describe("礼物Id"),
      }),
    )
    .output(GiftSchema)
    .query(async ({ ctx, input: { id } }) => {
      const existGift = await ctx.db.gift.findUnique({
        where: { id },
      });

      if (!existGift) {
        throw GIFT_NOT_EXISTS_INCORRECT();
      }

      return { ...existGift };
    }),
  deleteGiftById: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/delete/{id}`,
        tags: [TAG],
        protect: true,
        summary: "根据Id删除礼物",
      },
    })
    .input(
      z.object({
        id: z
          .number({ required_error: "restaurant:giftIdRequired" })
          .describe("礼物Id"),
      }),
    )
    .output(z.boolean().describe("是否删除成功,true 成功 false 失败"))
    .mutation(async ({ ctx, input: { id } }) => {
      const existGift = await ctx.db.gift.findUnique({
        where: { id },
      });

      if (!existGift) {
        throw GIFT_NOT_EXISTS_INCORRECT();
      }

      await ctx.db.gift.delete({
        where: { id },
      });

      return true;
    }),
  updateGiftById: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/update/{id}`,
        tags: [TAG],
        protect: true,
        summary: "根据Id更新礼物",
      },
    })
    .input(
      z.object({
        id: z
          .number({ required_error: "restaurant:giftIdRequired" })
          .describe("礼物Id"),
        updateData: GiftInputSchema,
      }),
    )
    .output(z.boolean().describe("是否更新成功,true 成功 false 失败"))
    .mutation(async ({ ctx, input }) => {
      const brandId = ctx.session.brandId;

      const existGift = await ctx.db.gift.findUnique({
        where: { id: input.id },
      });

      if (!existGift) {
        throw GIFT_NOT_EXISTS_INCORRECT();
      }

      const existNameGift = await ctx.db.gift.findFirst({
        where: {
          brandId: brandId,
          AND: [
            {
              OR: [
                { name: input.updateData.name },
                { en_name: input.updateData.en_name },
              ],
            },
            {
              id: { not: input.id },
            },
          ],
        },
      });
      if (existNameGift) {
        throw GIFT_NAME_EXISTS_INCORRECT();
      }

      await ctx.db.gift.update({
        where: { id: input.id },
        data: {
          ...input.updateData,
          updateBy: ctx.session.userId,
        },
      });
      return true;
    }),
  listGift: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/list`,
        tags: [TAG],
        protect: true,
        summary: "获取当前登陆餐厅品牌礼物列表",
      },
    })
    .input(
      z.object({
        type: z
          .nativeEnum(GiftType)
          .optional()
          .describe("礼物类型,LUCKY_DRAW 抽奖 SIGN_IN 签到"),
        isExchange: z
          .boolean()
          .optional()
          .describe("是否开启兑换礼物,true 是 false 否"),
        name: z.string().optional().describe("礼物名称"),
        enName: z.string().optional().describe("礼物英文名称"),
      }),
    )
    .output(z.array(GiftSchema))
    .query(async ({ ctx, input }) => {
      const brandId = ctx.session.brandId;

      const gifts = await ctx.db.gift.findMany({
        where: {
          type: input.type,
          brandId: brandId,
          name: { contains: input.name },
          en_name: { contains: input.enName },
          isExchange: input.isExchange,
        },
      });

      return gifts?.map((gift) => ({
        ...gift,
      }));
    }),
  pageGift: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/page`,
        tags: [TAG],
        protect: true,
        summary: "获取当前登陆餐厅品牌礼物分页",
      },
    })
    .input(
      asPageable(
        z.object({
          type: z.nativeEnum(GiftType).optional().describe("礼物类型"),
          isExchange: z
            .boolean()
            .optional()
            .describe("是否开启兑换礼物,true 是 false 否"),
          name: z.string().optional().describe("礼物名称"),
          enName: z.string().optional().describe("礼物英文名称"),
        }),
      ),
    )
    .output(asPagedResult(GiftSchema))
    .query(
      async ({
        ctx,
        input: { page, pageSize, type, isExchange, name, enName },
      }) => {
        const brandId = ctx.session.brandId;

        const where = {
          type: type,
          brandId: brandId,
          isExchange: isExchange,
          name: { contains: name },
          en_name: { contains: enName },
        };

        const totalCount = await ctx.db.gift.count({ where });
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

        const records = await ctx.db.gift.findMany({
          skip: (page - 1) * pageSize,
          take: pageSize,
          where,
          orderBy: {
            createAt: "desc",
          },
        });

        return {
          page,
          pageSize,
          pageCount,
          totalCount,
          record: records?.map((gift) => ({
            ...gift,
          })),
        };
      },
    ),
});
