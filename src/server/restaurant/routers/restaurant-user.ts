import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/customer/trpc";
import {
  USER_NOT_EXISTS_INCORRECT,
  RESTAURANT_NOT_EXISTS_INCORRECT,
  BRAND_NOT_EXISTS_INCORRECT,
  REGION_NOT_EXISTS_INCORRECT,
  MODIFY_PASSWORD_CAPTCHA_INCORRECT,
} from "../error";
import {
  comparePassword,
  encodePassword,
  asAccount as asReceiver,
} from "~/server/core/utils";
import {
  useCaptcha,
  CaptchaApp,
  CaptchaScene,
  CaptchaChannel,
} from "~/server/captcha";
import { Prisma } from "@prisma/client";
import {
  BrandSchema,
  RestaurantSchema,
  RestaurantRegionSchema,
  RestaurantUserSchema,
} from "prisma/generated/zod";

const PATH_PREFIX = "/restaurant/user";

export const TAG = "2001 - 餐厅 - 餐厅用户";

const RestaurantUserInputSchema = z.object({
  userName: z
    .string({ required_error: "restaurantUser:userNameRequired" })
    .max(100, "restaurantUser:userNameMaxLength")
    .describe("姓名"),
  nickname: z
    .string()
    .max(100, "restaurantUser:nicknameMaxLength")
    .nullish()
    .describe("昵称"),
  gender: z
    .string()
    .refine((value) => ["MALE", "FEMALE", "UNKNOWN"].includes(value), {
      message: "restaurantUser:genderValueError",
    })
    .nullish()
    .describe("性别:MALE、FEMALE 或 UNKNOWN"),
  avatar: z
    .string()
    .max(500, "restaurantUser:avatarMaxLength")
    .nullish()
    .describe("头像URL地址"),
});

const RestaurantOutputSchema = RestaurantSchema.extend({
  brand: BrandSchema.describe("品牌信息详情").nullish(),
  region: RestaurantRegionSchema.describe("地区信息").nullish(),
});

const RestaurantUserOutputSchema = RestaurantUserSchema.extend({
  restaurant: RestaurantOutputSchema.describe("餐厅信息").nullish(),
});

// 定义验证码接口出参
const CaptchaOutputSchema = z.object({
  app: z.nativeEnum(CaptchaApp).describe("应用"),
  scene: z.nativeEnum(CaptchaScene).describe("场景"),
  channel: z.nativeEnum(CaptchaChannel).describe("发送渠道"),
  receiver: z.string().describe("接收邮箱"),
  expireAt: z.date().describe("过期时间"),
});

export const RestaurantUserRouter = createTRPCRouter({
  getUser: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/get-by-login`,
        tags: [TAG],
        protect: true,
        summary: "获取登陆用户餐厅品牌完整信息",
      },
    })
    .input(z.void())
    .output(RestaurantUserOutputSchema)
    .query(async ({ ctx }) => {
      const userId = ctx.session.userId;

      const existUser = await ctx.db.restaurantUser.findUnique({
        where: { id: userId },
      });

      if (!existUser) {
        throw USER_NOT_EXISTS_INCORRECT();
      }

      const brand = await ctx.db.brand.findUnique({
        where: { id: existUser.brandId, deleteAt: 0 },
      });

      if (!brand) {
        throw BRAND_NOT_EXISTS_INCORRECT();
      }

      const restaurant = await ctx.db.restaurant.findUnique({
        where: { id: existUser.restaurantId, deleteAt: 0 },
      });

      if (!restaurant) {
        throw RESTAURANT_NOT_EXISTS_INCORRECT();
      }

      const region = await ctx.db.restaurantRegion.findUnique({
        where: { code: restaurant.regionCode },
      });

      if (!region) {
        throw REGION_NOT_EXISTS_INCORRECT();
      }

      return {
        ...existUser,
        restaurant: {
          ...restaurant,
          brand: brand,
          region: region,
        },
      };
    }),
  updateUserById: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/update`,
        tags: [TAG],
        protect: true,
        summary: "更新当前登陆用户基本信息",
      },
    })
    .input(RestaurantUserInputSchema)
    .output(z.boolean().describe("是否更新成功,true 成功 false 失败"))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.userId;

      const existUser = await ctx.db.restaurantUser.findUnique({
        where: { id: userId },
      });

      if (!existUser) {
        throw USER_NOT_EXISTS_INCORRECT();
      }

      await ctx.db.restaurantUser.update({
        where: { id: userId },
        data: {
          ...input,
          restaurantId: existUser.restaurantId,
          brandId: existUser.brandId,
          phoneAreaCode: existUser.phoneAreaCode,
          phone: existUser.phone,
          account: existUser.account,
          password: existUser.password,
          isBrandMain: existUser.isBrandMain,
          isEnabled: existUser.isEnabled,
          disabledReason: existUser.disabledReason,
          updateBy: ctx.session.userId,
        },
      });
      return true;
    }),

  sendModifyPasswordCode: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/send-modify-password-code`,
        tags: [TAG],
        protect: true,
        summary: "当前登陆餐厅用户发送修改密码验证码",
      },
    })
    .input(z.void())
    .output(CaptchaOutputSchema)
    .mutation(async ({ ctx }) => {
      const existUser = await ctx.db.member.findUnique({
        where: { id: ctx.session.userId },
      });

      if (!existUser) {
        throw USER_NOT_EXISTS_INCORRECT();
      }

      const receiver = asReceiver({
        phoneAreaCode: existUser.phoneAreaCode || "",
        phone: existUser.phone || "",
      });

      const { send: sendCaptcha } = useCaptcha(
        CaptchaApp.RESTAURANT,
        CaptchaScene.MODIFY_PASSWORD,
        CaptchaChannel.SMS,
      );

      return await sendCaptcha(receiver);
    }),
  updateMemberPassword: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/update-user-password`,
        tags: [TAG],
        protect: true,
        summary: "当前登陆餐厅用户修改登录密码",
      },
    })
    .input(
      z.object({
        captcha: z
          .string({
            required_error: "restaurant:modifyPasswordCaptchaRequired",
          })
          .describe("验证码"),
        password: z
          .object({
            input: z
              .string({ required_error: "restaurant:newPasswordRequired" })
              .describe("输入密码"),
            confirm: z
              .string({
                required_error: "restaurant:newPasswordConfirmRequired",
              })
              .describe("确认密码"),
          })
          .refine(
            ({ input, confirm }) => input === confirm,
            "restaurant:passwordMatchError",
          ),
      }),
    )
    .output(z.void())
    .mutation(async ({ ctx, input: { captcha, password } }) => {
      const existUser = await ctx.db.member.findUnique({
        where: { id: ctx.session.userId },
      });

      if (!existUser) {
        throw USER_NOT_EXISTS_INCORRECT();
      }

      const receiver = asReceiver({
        phoneAreaCode: existUser.phoneAreaCode || "",
        phone: existUser.phone || "",
      });

      const { id } = existUser;

      const { verify: verifyCaptcha, clean: cleanCaptcha } = useCaptcha(
        CaptchaApp.RESTAURANT,
        CaptchaScene.FORGOT_PASSWORD,
        CaptchaChannel.SMS,
      );

      // 校验验证码
      const valid = await verifyCaptcha(receiver, captcha);
      if (!valid) {
        throw MODIFY_PASSWORD_CAPTCHA_INCORRECT();
      }
      // 验证码校验通过后，从 reids 删除
      await cleanCaptcha(receiver);

      await ctx.db.member.update({
        where: { id },
        data: { password: await encodePassword(password.input) },
      });
    }),
});
