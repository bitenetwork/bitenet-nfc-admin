import { z } from "zod";
import _ from "lodash";
import {
  TRPCError,
  type inferRouterContext,
  type inferRouterInputs,
} from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "~/server/admin/trpc";
import { BrandLevelType } from "@prisma/client";

type RouterContext = inferRouterContext<ReturnType<typeof createTRPCRouter>>;

const toDateTransformer = (value: string) => new Date(value);

const allowedTypes = [
  BrandLevelType.BASIC,
  BrandLevelType.EXPIRED,
  BrandLevelType.PREMIUM,
] as const;

const CreateBrandInputSchema = z.object({
  name: z
    .string({ required_error: "Brand name is required " })
    .max(100, "Brand name is too long"),
  en_name: z
    .string({ required_error: "Brand english name is required " })
    .max(100, "Brand english name is too long"),
  levelType: z
    .nativeEnum(BrandLevelType)
    .refine((value) => allowedTypes.includes(value!), {
      message: "Brand level type error",
    }),
  contacts: z.string().max(50, "Brand contacts is too long").nullish(),
  contactsWay: z.string().max(50, "Brand contacts way is too long").nullish(),
  logo: z.string().max(500, "Brand logo url is too long").nullish(),
  description: z
    .string()
    .max(500, "Brand description url is too long")
    .nullish(),
  en_description: z
    .string()
    .max(500, "Brand english description url is too long")
    .nullish(),
  expiredDate: z.string().transform(toDateTransformer).nullish(),
  sort: z.number().nullish(),
});

export const brandRouter = createTRPCRouter({
  // 新增
  createBrand: publicProcedure
    .input(CreateBrandInputSchema)
    .mutation(async ({ ctx, input }) => {
      await isBrandNameDuplicate(ctx, input);
      const { ...data } = input;
      return await ctx.db.brand.create({ data: { ...data } });
    }),
  // 删除
  deleteBrand: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const brandEntity = await ctx.db.brand.findUnique({
        where: { id: input.id },
      });
      if (!brandEntity) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Brand with id ${input.id} is not found`,
        });
      }
      const restaurant = await ctx.db.restaurant.findMany({
        where: { brandId: input.id },
      });

      if (restaurant) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `The brand information cannot be deleted. Please delete the restaurants under the brand first.`,
        });
      }

      return await ctx.db.brand.delete({ where: { id: input.id } });
    }),
  // 更新
  updateBrand: publicProcedure
    .input(z.object({ id: z.number(), data: CreateBrandInputSchema }))
    .mutation(async ({ ctx, input }) => {
      const brandEntity = await ctx.db.brand.findUnique({
        where: { id: input.id },
      });
      if (!brandEntity) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Brand with id ${input.id} is not found`,
        });
      }
      return await ctx.db.brand.update({
        data: input.data,
        where: { id: input.id },
      });
    }),
  // 根据Id查询
  findBrandById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx: { db }, input: { id } }) =>
      db.brand.findUnique({ where: { id } }),
    ),
  // 查询
  listBrand: publicProcedure
    .input(z.object({ name: z.string().optional() }))
    .query(async ({ ctx: { db }, input: { name } }) =>
      db.brand.findMany({ where: { name } }),
    ),
  // 分页查询
  queryBrand: publicProcedure
    .input(
      z.object({
        page: z.number().default(1),
        pageSize: z.number().default(30),
        name: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input: { page, pageSize, ...input } }) => {
      const where = {
        name: {
          contains: input.name,
        },
      };
      const total = await ctx.db.brand.count({ where });
      const totalPage = Math.ceil(total / pageSize);
      const record =
        total > 0
          ? await ctx.db.brand.findMany({
              skip: (page - 1) * pageSize,
              take: pageSize,
              where,
            })
          : [];
      return {
        page,
        pageSize,
        total,
        totalPage,
        record,
      };
    }),
});

async function isBrandNameDuplicate(
  { db }: RouterContext,
  { name }: { name: string },
) {
  if (_.isEmpty(name)) {
    return;
  }
  const existBrand = await db.brand.findFirst({
    where: { name },
  });
  if (existBrand) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Brand with name ${name} is exist`,
    });
  }
}
