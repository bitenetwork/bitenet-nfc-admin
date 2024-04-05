import { z } from "zod";
import _ from "lodash";
import {
  TRPCError,
  type inferRouterContext,
  type inferRouterInputs,
} from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/admin/trpc";
import { encodePassword } from "~/server/core/utils";

type RouterContext = inferRouterContext<ReturnType<typeof createTRPCRouter>>;

type CreateRestaurantUserInput = inferRouterInputs<
  typeof restaurantUserRouter
>["createRestaurantUser"];

const CreateRestaurantUserInputSchema = z.object({
  brandId: z.number(),
  restaurantId: z.number(),
  userName: z
    .string()
    .min(1, "Missing user name")
    .max(100, "User name is too long"),
  phoneAreaCode: z
    .string()
    .min(1, "Missing phone area code")
    .max(4, "Phone area code is too long"),
  phone: z.string().min(1, "Missing phone").max(32, "Phone is too long"),
  account: z
    .string()
    .min(1, "Missing user account")
    .max(64, "User account is too long"),
  nickname: z.string().max(100, "Nickname is too long").nullish(),
  avatar: z.string().max(255, "Avatar is too long").nullish(),
  gender: z.string().max(10, "Gender is too long").nullish(),
  isEnabled: z.boolean(),
  disabledReason: z.string().max(255, "Disabled reason is too long").nullish(),
});
export const restaurantUserRouter = createTRPCRouter({
  // 新增
  createRestaurantUser: protectedProcedure
    .input(CreateRestaurantUserInputSchema)
    .mutation(async ({ ctx, input }) => {
      await isAccountDuplicate(ctx, input);
      await isPhoneDuplicate(ctx, input);
      // 默认密码
      const password = await encodePassword("123456");
      return await ctx.db.restaurantUser.create({
        data: { ...input, password: password, isBrandMain: true },
      });
    }),
  // 删除
  deleteRestaurantUser: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const restaurantUserEntity = await ctx.db.restaurantUser.findUnique({
        where: { id: input.id },
      });
      if (!restaurantUserEntity) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Restaurant with id ${input.id} is not found`,
        });
      }
      return await ctx.db.restaurantUser.delete({ where: { id: input.id } });
    }),
  // 更新
  updateRestaurantUser: protectedProcedure
    .input(z.object({ id: z.number(), data: CreateRestaurantUserInputSchema }))
    .mutation(async ({ ctx, input }) => {
      const restaurantUserEntity = await ctx.db.restaurantUser.findUnique({
        where: { id: input.id },
      });
      if (!restaurantUserEntity) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Brand with id ${input.id} is not found`,
        });
      }
      return await ctx.db.restaurantUser.update({
        data: {
          ...input.data,
          password: restaurantUserEntity.password,
          isBrandMain: restaurantUserEntity.isBrandMain,
        },
        where: { id: input.id },
      });
    }),
  // 根据Id查询
  findRestaurantUserById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx: { db }, input: { id } }) =>
      db.restaurantUser.findUnique({ where: { id } }),
    ),
  // 分页查询
  queryRestaurantUser: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        pageSize: z.number().default(30),
        account: z.string().optional(),
        userName: z.string().optional(),
        phone: z.string().optional(),
        restaurantId: z.number().optional(),
      }),
    )
    .query(async ({ ctx, input: { page, pageSize, ...input } }) => {
      const where = {
        account: {
          contains: input.account,
        },
        userName: {
          contains: input.userName,
        },
        phone: {
          contains: input.phone,
        },
        restaurantId: input.restaurantId,
      };
      const total = await ctx.db.restaurantUser.count({ where });
      const totalPage = Math.ceil(total / pageSize);
      const record =
        total > 0
          ? await ctx.db.restaurantUser.findMany({
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

async function isAccountDuplicate(
  { db }: RouterContext,
  { account }: CreateRestaurantUserInput,
) {
  if (_.isEmpty(account)) {
    return;
  }
  const existRestaurantUser = await db.restaurantUser.findUnique({
    where: { account_deleteAt: { account: account, deleteAt: 0 } },
  });
  if (existRestaurantUser) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Restaurant user with account ${account} is exist`,
    });
  }
}

async function isPhoneDuplicate(
  { db }: RouterContext,
  { phone, phoneAreaCode }: CreateRestaurantUserInput,
) {
  if (_.isEmpty(phone) || _.isEmpty(phoneAreaCode)) {
    return;
  }
  const existRestaurantUser = await db.restaurantUser.findUnique({
    where: {
      phoneAreaCode_phone_deleteAt: {
        phoneAreaCode: phoneAreaCode,
        phone: phone,
        deleteAt: 0,
      },
    },
  });
  if (existRestaurantUser) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Restaurant user with phone ${phoneAreaCode}-${phone}  is exist`,
    });
  }
}
