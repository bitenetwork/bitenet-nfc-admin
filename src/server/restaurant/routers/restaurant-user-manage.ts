import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/customer/trpc";
import {
  USER_NOT_EXISTS_INCORRECT,
  USER_PHONE_EXISTS_INCORRECT,
  USER_ACCOUNT_EXISTS_INCORRECT,
} from "../error";
import {
  comparePassword,
  encodePassword,
  asAccount as asReceiver,
} from "~/server/core/utils";
import { asPageable, asPagedResult } from "~/server/core/schema";
import { RestaurantUserSchema } from "prisma/generated/zod";

const PATH_PREFIX = "/restaurant/user/manage";

export const TAG = "200101 - 餐厅 - 餐厅用户管理";

export const RestaurantUserInputSchema = z.object({
  userName: z
    .string({ required_error: "restaurant:userNameRequired" })
    .max(100, "restaurant:userNameMaxLength")
    .describe("用户名"),
  phoneAreaCode: z
    .string({ required_error: "restaurant:phoneAreaCodeRequired" })
    .max(4, "restaurant:phoneAreaCodeMaxLength")
    .describe("手机号区域代码"),
  phone: z
    .string({ required_error: "restaurant:phoneRequired" })
    .max(32, "restaurant:phoneMaxLength")
    .describe("手机号"),
  account: z
    .string({ required_error: "restaurant:accountRequired" })
    .max(64, "restaurant:accountMaxLength")
    .describe("账号"),
  nickname: z
    .string()
    .max(100, "restaurant:nicknameMaxLength")
    .nullish()
    .describe("昵称"),
  gender: z
    .string()
    .max(10, "restaurant:genderMaxLength")
    .nullish()
    .describe("性别"),
  avatar: z
    .string()
    .max(500, "restaurant:avatarMaxLength")
    .nullish()
    .describe("头像URL地址"),
  roles: z
    .string()
    .max(255, "restaurant:rolesMaxLength")
    .nullish()
    .describe("所属角色，多个角色以，隔开"),
  isEnabled: z.boolean().describe("账户是否可用"),
  disabledReason: z
    .string()
    .max(500, "restaurant:disabledReasonMaxLength")
    .nullish()
    .describe("账号不可用原因"),
});

const RestaurantUserOutputSchema = RestaurantUserSchema.omit({
  password: true,
});

export const RestaurantUserManageRouter = createTRPCRouter({
  createRestaurantUser: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/create`,
        tags: [TAG],
        protect: true,
        summary: "创建餐厅用户（默认密码123456，默认非品牌主账号）",
      },
    })
    .input(RestaurantUserInputSchema)
    .output(z.boolean().describe("是否创建成功,true 成功 false 失败"))
    .mutation(async ({ ctx, input }) => {
      let existUser = await ctx.db.restaurantUser.findUnique({
        where: { account_deleteAt: { account: input.account, deleteAt: 0 } },
      });

      if (existUser) {
        throw USER_ACCOUNT_EXISTS_INCORRECT();
      }

      existUser = await ctx.db.restaurantUser.findUnique({
        where: {
          phoneAreaCode_phone_deleteAt: {
            phoneAreaCode: input.phoneAreaCode,
            phone: input.phone,
            deleteAt: 0,
          },
        },
      });

      if (existUser) {
        throw USER_PHONE_EXISTS_INCORRECT();
      }

      const password = await encodePassword("123456");
      await ctx.db.restaurantUser.create({
        data: {
          ...input,
          createBy: ctx.session.userId,
          updateBy: ctx.session.userId,
          isBrandMain: false,
          password: password,
          restaurantId: ctx.session.restaurantId,
          brandId: ctx.session.brandId,
        },
      });
      return true;
    }),
  getRestaurantUserById: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/get/{id}`,
        tags: [TAG],
        protect: true,
        summary: "根据Id获取餐厅用户详情",
      },
    })
    .input(
      z.object({
        id: z
          .number({ required_error: "restaurant:userIdRequired" })
          .describe("用户Id"),
      }),
    )
    .output(RestaurantUserOutputSchema)
    .query(async ({ ctx, input: { id } }) => {
      const existUser = await ctx.db.restaurantUser.findUnique({
        where: { id },
      });

      if (!existUser) {
        throw USER_NOT_EXISTS_INCORRECT();
      }

      // 不返回敏感信息如密码等
      const { password: _, ...safeUser } = existUser;

      return safeUser;
    }),
  deleteRestaurantUserById: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/delete/{id}`,
        tags: [TAG],
        protect: true,
        summary: "根据Id删除餐厅用户",
      },
    })
    .input(
      z.object({
        id: z
          .number({ required_error: "restaurant:userIdRequired" })
          .describe("用户Id"),
      }),
    )
    .output(z.boolean().describe("是否删除成功,true 成功 false 失败"))
    .mutation(async ({ ctx, input: { id } }) => {
      const existUser = await ctx.db.restaurantUser.findUnique({
        where: { id },
      });

      if (!existUser) {
        throw USER_NOT_EXISTS_INCORRECT();
      }
      await ctx.db.restaurantUser.delete({
        where: { id },
      });
      return true;
    }),
  updateRestaurantUserById: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/update/{id}`,
        tags: [TAG],
        protect: true,
        summary: "根据Id更新餐厅用户",
      },
    })
    .input(
      z.object({
        id: z
          .number({ required_error: "restaurant:userIdRequired" })
          .describe("用户Id"),
        updateData: RestaurantUserInputSchema,
      }),
    )
    .output(z.boolean().describe("是否更新成功,true 成功 false 失败"))
    .mutation(async ({ ctx, input }) => {
      const existUser = await ctx.db.restaurantUser.findUnique({
        where: { id: input.id },
      });

      if (!existUser) {
        throw USER_NOT_EXISTS_INCORRECT();
      }

      let conflictingUser = await ctx.db.restaurantUser.findUnique({
        where: {
          account_deleteAt: { account: input.updateData.account, deleteAt: 0 },
        },
      });

      if (conflictingUser && conflictingUser.id !== input.id) {
        throw USER_ACCOUNT_EXISTS_INCORRECT();
      }

      conflictingUser = await ctx.db.restaurantUser.findUnique({
        where: {
          phoneAreaCode_phone_deleteAt: {
            phoneAreaCode: input.updateData.phoneAreaCode,
            phone: input.updateData.phone,
            deleteAt: 0,
          },
        },
      });

      if (conflictingUser && conflictingUser.id !== input.id) {
        throw USER_PHONE_EXISTS_INCORRECT();
      }

      await ctx.db.restaurantUser.update({
        where: { id: input.id },
        data: {
          ...input.updateData,
          isBrandMain: existUser.isBrandMain,
          password: existUser.password,
          restaurantId: existUser.restaurantId,
          brandId: existUser.brandId,
          updateBy: ctx.session.userId,
        },
      });

      return true;
    }),
  listRestaurantUsers: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/list`,
        tags: [TAG],
        protect: true,
        summary: "获取当前登陆品牌下的餐厅用户列表",
      },
    })
    .input(
      z.object({
        userName: z.string().optional().describe("用户名"),
        phone: z.string().optional().describe("手机号"),
        account: z.string().optional().describe("账号"),
        isEnabled: z.boolean().optional().describe("账户是否启用"),
      }),
    )
    .output(z.array(RestaurantUserOutputSchema))
    .query(async ({ ctx, input }) => {
      const brandId = ctx.session.brandId;

      const users = await ctx.db.restaurantUser.findMany({
        where: {
          brandId,
          ...(input.userName && { userName: { contains: input.userName } }),
          ...(input.phone && { phone: { contains: input.phone } }),
          ...(input.account && { account: { equals: input.account } }),
          ...(typeof input.isEnabled === "boolean" && {
            isEnabled: input.isEnabled,
          }),
        },
      });

      return users?.map((user) => {
        const { password: _, ...safeUser } = user;
        return safeUser;
      });
    }),

  pageRestaurantUsers: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/page`,
        tags: [TAG],
        protect: true,
        summary: "获取当前登陆品牌下的餐厅用户分页",
      },
    })
    .input(
      asPageable(
        z.object({
          userName: z.string().optional().describe("用户名"),
          phone: z.string().optional().describe("手机号"),
          account: z.string().optional().describe("账号"),
          isEnabled: z.boolean().optional().describe("账户是否启用"),
        }),
      ),
    )
    .output(asPagedResult(RestaurantUserOutputSchema))
    .query(
      async ({
        ctx,
        input: { page, pageSize, userName, phone, account, isEnabled },
      }) => {
        const brandId = ctx.session.brandId;

        const where = {
          brandId,
          ...(userName && { userName: { contains: userName } }),
          ...(phone && { phone: { contains: phone } }),
          ...(account && { account: { equals: account } }),
          ...(typeof isEnabled === "boolean" && { isEnabled }),
        };

        const totalCount = await ctx.db.restaurantUser.count({ where });
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

        const records = await ctx.db.restaurantUser.findMany({
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
          record: records?.map((user) => {
            const { password: _, ...safeUser } = user;
            return safeUser;
          }),
        };
      },
    ),
});
