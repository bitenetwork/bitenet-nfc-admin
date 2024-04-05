import { z } from "zod";
import _ from "lodash";
import {
  TRPCError,
  type inferRouterContext,
  type inferRouterInputs,
} from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/admin/trpc";
import {
  generateUniqueString,
  generateRandomSixDigitsWithPrefix,
} from "~/server/core/utils";
import { db } from "~/server/db";

type RouterContext = inferRouterContext<ReturnType<typeof createTRPCRouter>>;

type CreateRestaurantInput = inferRouterInputs<
  typeof restaurantRouter
>["createRestaurant"];

const CreateRestaurantInputSchema = z.object({
  brandId: z.number({ required_error: "Missing restaurant brand" }),
  name: z
    .string({ required_error: "Missing restaurant name" })
    .max(255, "Restaurant name is too long"),
  en_name: z
    .string({ required_error: "Missing restaurant english name" })
    .max(255, "Restaurant english name is too long"),
  address: z
    .string({ required_error: "Missing restaurant address " })
    .max(500, "Restaurant address is too long"),
  en_address: z
    .string({ required_error: "Missing english restaurant address " })
    .max(500, "Restaurant english address is too long"),
  regionCode: z
    .string({ required_error: "Missing restaurant region " })
    .max(50, "Restaurant region is too long"),
  contacts: z
    .string({ required_error: "Missing restaurant contacts" })
    .max(50, "Restaurant contacts is too long"),
  contactsWay: z
    .string({ required_error: "Missing restaurant contacts way" })
    .max(32, "Restaurant contacts way is too long"),
  cover: z
    .string({ required_error: "Missing restaurant cover" })
    .max(500, "Restaurant cover way is too long"),
  // lng: z
  //   .number({ required_error: "Missing restaurant lng" })
  //   .transform((v) => parseFloat(v.toFixed(7))),
  // lat: z
  //   .number({ required_error: "Missing restaurant lat" })
  //   .transform((v) => parseFloat(v.toFixed(7))),
  description: z
    .string()
    .max(500, "Restaurant description is too long")
    .nullish(),
  en_description: z
    .string()
    .max(500, "Restaurant english description is too long")
    .nullish(),
  minimumCharge: z
    .number()
    .min(0, "Restaurant english description must be greater than 0")
    .nullish(),
  isMainStore: z.boolean({
    required_error: "Missing restaurant is main store",
  }),
  cuisineTypeId: z.number().default(0),
});
export const restaurantRouter = createTRPCRouter({
  // 新增
  createRestaurant: protectedProcedure
    .input(CreateRestaurantInputSchema)
    .mutation(async ({ ctx, input }) => {
      await isRestaurantNameDuplicate(ctx, input);

      const { ...data } = input;
      const codeStr = generateUniqueString();
      const indexCode = generateRandomSixDigitsWithPrefix();
      return await ctx.db.restaurant.create({
        data: {
          ...data,
          code: codeStr,
          indexCode: indexCode,
          lat: "22.3194068",
          lng: "114.1692081",
        },
      });
    }),
  // 删除
  deleteRestaurant: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const restaurantEntity = await ctx.db.restaurant.findUnique({
        where: { id: input.id },
      });
      if (!restaurantEntity) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Restaurant with id ${input.id} is not found`,
        });
      }
      const restaurantUser = await ctx.db.restaurantUser.findMany({
        where: { restaurantId: input.id },
      });

      if (restaurantUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Cannot delete restaurant information. Please delete the associated restaurant user first.`,
        });
      }

      return await ctx.db.restaurant.delete({ where: { id: input.id } });
    }),
  // 更新
  updateRestaurant: protectedProcedure
    .input(z.object({ id: z.number(), data: CreateRestaurantInputSchema }))
    .mutation(async ({ ctx, input }) => {
      const restaurantEntity = await ctx.db.restaurant.findUnique({
        where: { id: input.id },
      });
      if (!restaurantEntity) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Brand with id ${input.id} is not found`,
        });
      }
      return await ctx.db.restaurant.update({
        data: {
          ...input.data,
          lat: restaurantEntity.lat,
          lng: restaurantEntity.lng,
        },
        where: { id: input.id },
      });
    }),
  // 根据Id查询
  findRestaurantById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx: { db }, input: { id } }) =>
      db.restaurant.findUnique({ where: { id } }),
    ),
  // 列表查询
  listRestaurant: protectedProcedure
    .input(z.object({ name: z.string().optional() }))
    .query(async ({ ctx: { db }, input: { name } }) =>
      db.restaurant.findMany({ where: { name } }),
    ),
  // 分页查询
  queryRestaurant: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        pageSize: z.number().default(30),
        name: z.string().optional(),
        brandId: z.number().optional(),
      }),
    )
    .query(async ({ ctx, input: { page, pageSize, ...input } }) => {
      const where = {
        name: {
          contains: input.name,
        },
        brandId: input.brandId,
      };

      const total = await ctx.db.restaurant.count({ where });
      const totalPage = Math.ceil(total / pageSize);
      const record =
        total > 0
          ? await ctx.db.restaurant.findMany({
              skip: (page - 1) * pageSize,
              take: pageSize,
              where,
            })
          : [];
      const brandMap = new Map();
      if (record.length > 0) {
        const brandIds = record.map((item) => item.brandId);
        const brands = await ctx.db.brand.findMany({
          where: { id: { in: brandIds } },
        });
        for (const brand of brands) {
          brandMap.set(brand.id, brand.name);
        }
      }
      const cuisineTypeList = await ctx.db.cuisineType.findMany({});
      const cuisineTypeMap = Object.fromEntries(
        cuisineTypeList.map((x) => [x.id, x]),
      );

      return {
        page,
        pageSize,
        total,
        totalPage,
        record: record.map((restaurant) => ({
          ...restaurant,
          brandName: brandMap.get(restaurant.brandId), // 添加品牌名称字段
          cuisineType: cuisineTypeMap[restaurant.cuisineTypeId],
        })),
      };
    }),
});

async function isRestaurantNameDuplicate(
  { db }: RouterContext,
  { name }: CreateRestaurantInput,
) {
  if (_.isEmpty(name)) {
    return;
  }
  const existRestaurant = await db.restaurant.findFirst({
    where: { name },
  });
  if (existRestaurant) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Restaurant with name ${name} is exist`,
    });
  }
}
