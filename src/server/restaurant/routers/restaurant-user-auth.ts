import { z } from "zod";
import _ from "lodash";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { SessionApp, useSession } from "~/server/session";
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
import {
  ACCOUNT_NOT_EXISTS_INCORRECT,
  PASSWORD_INCORRECT,
  SIGN_IN_CAPTCHA_INCORRECT,
  ACCOUNT_DISABLED_INCORRECT,
  FORGOT_PASSWORD_CAPTCHA_INCORRECT,
  ACCOUNT_EXPIRED_INCORRECT,
  BRAND_NOT_EXISTS_INCORRECT,
} from "../error";
import { RestaurantUserSchema } from "prisma/generated/zod";

const PATH_PREFIX = "/restaurant-user/auth";

// 创建 Session 创建更新函数
const { update: updateSession, remove: removeSession } = useSession(
  SessionApp.RESTAURANT,
);

// Swagger 接口标签分组定义
export const TAG = "1000 - 餐厅 - 登陆登出";

// 定义登陆接口入参
const RestaurantUserOutputSchema = RestaurantUserSchema.omit({
  password: true,
}).extend({
  token: z.string().describe("登录令牌"),
});

// 定义验证码接口出参
const CaptchaOutputSchema = z.object({
  app: z.nativeEnum(CaptchaApp).describe("应用"),
  scene: z.nativeEnum(CaptchaScene).describe("场景"),
  channel: z.nativeEnum(CaptchaChannel).describe("发送渠道"),
  receiver: z.string().describe("接收邮箱"),
  expireAt: z.date().describe("过期时间"),
});

export const RestaurantUserAuthRouter = createTRPCRouter({
  signInByPassword: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/sign-in-by-password`,
        tags: [TAG],
        summary: "餐厅用户密码登录",
      },
    })
    .input(
      z.object({
        account: z
          .string({ required_error: "restaurantUser:accountRequired" })
          .describe("用户账号"),
        password: z
          .string({ required_error: "restaurantUser:passwordRequired" })
          .describe("密码"),
      }),
    )
    .output(RestaurantUserOutputSchema)
    .mutation(async ({ ctx, input: { password, ...input } }) => {
      const account = input.account;
      const restaurantUser = await ctx.db.restaurantUser.findUnique({
        where: { account_deleteAt: { account: account, deleteAt: 0 } },
      });
      if (!restaurantUser) {
        throw ACCOUNT_NOT_EXISTS_INCORRECT();
      }

      if (!(await comparePassword(password, restaurantUser))) {
        throw PASSWORD_INCORRECT();
      }

      if (!restaurantUser.isEnabled) {
        throw ACCOUNT_DISABLED_INCORRECT();
      }

      const brand = await ctx.db.brand.findUnique({
        where: { id: restaurantUser.brandId },
      });

      if (!brand) {
        throw BRAND_NOT_EXISTS_INCORRECT();
      }

      if (brand.levelType === "EXPIRED") {
        throw ACCOUNT_EXPIRED_INCORRECT();
      }

      const session = await updateSession({
        session: {
          userId: restaurantUser.id,
          account: restaurantUser.account,
          brandId: restaurantUser.brandId,
          restaurantId: restaurantUser.restaurantId,
        },
      });

      return { ...restaurantUser, token: session.id };
    }),
  sendSignInCode: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/send-sign-in-code`,
        tags: [TAG],
        summary: "餐厅用户发送登录验证码",
      },
    })
    .input(
      z.object({
        phoneAreaCode: z
          .string({ required_error: "restaurant:phoneAreaCodeRequired" })
          .describe("电话区号"),
        phone: z
          .string({ required_error: "restaurant:phoneRequired" })
          .describe("电话号码"),
      }),
    )
    .output(CaptchaOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const receiver = asReceiver(input);
      const where = {
        phoneAreaCode_phone_deleteAt: {
          phoneAreaCode: input.phoneAreaCode,
          phone: input.phone,
          deleteAt: 0,
        },
      };

      const restaurantUser = await ctx.db.restaurantUser.findUnique({ where });
      if (!restaurantUser) {
        throw ACCOUNT_NOT_EXISTS_INCORRECT();
      }

      if (!restaurantUser.isEnabled) {
        throw ACCOUNT_DISABLED_INCORRECT();
      }

      const brand = await ctx.db.brand.findUnique({
        where: { id: restaurantUser.brandId },
      });

      if (!brand) {
        throw BRAND_NOT_EXISTS_INCORRECT();
      }

      if (brand.levelType === "EXPIRED") {
        throw ACCOUNT_EXPIRED_INCORRECT();
      }

      const { send: sendCaptcha } = useCaptcha(
        CaptchaApp.RESTAURANT,
        CaptchaScene.SIGN_IN,
        CaptchaChannel.SMS,
      );

      return await sendCaptcha(receiver);
    }),
  signInByCaptcha: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/sign-in-by-captcha`,
        tags: [TAG],
        summary: "餐厅用户验证码登录",
      },
    })
    .input(
      z.object({
        phoneAreaCode: z
          .string({ required_error: "restaurant:phoneAreaCodeRequired" })
          .describe("电话区号"),
        phone: z
          .string({ required_error: "restaurant:phoneRequired" })
          .describe("电话号码"),
        captcha: z
          .string({ required_error: "restaurant:signInCaptchaRequired" })
          .describe("验证码"),
      }),
    )
    .output(RestaurantUserOutputSchema)
    .mutation(async ({ ctx, input: { captcha, ...input } }) => {
      // 创建验证码校验与清空函数
      const { verify: verifyCaptcha, clean: cleanCaptcha } = useCaptcha(
        CaptchaApp.RESTAURANT, // 应用为客户端
        CaptchaScene.SIGN_IN, // 场景为注册
        CaptchaChannel.SMS, // 验证码发送渠道为短信
      );
      const where = {
        phoneAreaCode_phone_deleteAt: {
          phoneAreaCode: input.phoneAreaCode,
          phone: input.phone,
          deleteAt: 0,
        },
      };
      const restaurantUser = await ctx.db.restaurantUser.findUnique({ where });

      if (!restaurantUser) {
        throw ACCOUNT_NOT_EXISTS_INCORRECT();
      }

      if (!restaurantUser.isEnabled) {
        throw ACCOUNT_DISABLED_INCORRECT();
      }

      // 校验登录验证码
      const receiver = asReceiver(input);
      const valid = await verifyCaptcha(receiver, captcha);
      if (!valid) {
        throw SIGN_IN_CAPTCHA_INCORRECT();
      }
      // 验证码校验通过后，从 reids 删除
      await cleanCaptcha(receiver);

      const session = await updateSession({
        session: {
          userId: restaurantUser.id,
          account: restaurantUser.account,
          brandId: restaurantUser.brandId,
          restaurantId: restaurantUser.restaurantId,
        },
      });

      return { ...restaurantUser, token: session.id };
    }),

  logout: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/logout`,
        tags: [TAG],
        summary: "退出登录",
      },
    })
    .input(z.void())
    .output(z.void())
    .mutation(async ({ ctx }) => {
      await removeSession(ctx.session.id);
    }),
  sendForgotPasswordCode: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/send-forgot-password-code`,
        tags: [TAG],
        summary: "餐厅用户发送忘记密码验证码",
      },
    })
    .input(
      z.object({
        phoneAreaCode: z
          .string({ required_error: "restaurant:phoneAreaCodeRequired" })
          .describe("电话区号"),
        phone: z
          .string({ required_error: "restaurant:phoneRequired" })
          .describe("电话号码"),
      }),
    )
    .output(CaptchaOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const receiver = asReceiver(input);
      const where = {
        phoneAreaCode_phone_deleteAt: {
          phoneAreaCode: input.phoneAreaCode,
          phone: input.phone,
          deleteAt: 0,
        },
      };
      const restaurantUser = await ctx.db.restaurantUser.findUnique({ where });
      if (!restaurantUser) {
        throw ACCOUNT_NOT_EXISTS_INCORRECT();
      }

      if (!restaurantUser.isEnabled) {
        throw ACCOUNT_DISABLED_INCORRECT();
      }

      const { send: sendCaptcha } = useCaptcha(
        CaptchaApp.RESTAURANT,
        CaptchaScene.FORGOT_PASSWORD,
        CaptchaChannel.SMS,
      );

      return await sendCaptcha(receiver);
    }),
  updateMemberForgotPassword: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/update-user-forgot-password`,
        tags: [TAG],
        summary: "餐厅用户忘记密码修改登录密码",
      },
    })
    .input(
      z.object({
        phoneAreaCode: z
          .string({ required_error: "restaurant:phoneAreaCodeRequired" })
          .describe("电话区号"),
        phone: z
          .string({ required_error: "restaurant:phoneRequired" })
          .describe("电话号码"),
        captcha: z
          .string({
            required_error: "restaurant:forgotPasswordCaptchaRequired",
          })
          .describe("验证码"),
        password: z
          .object({
            input: z
              .string({
                required_error: "restaurant:newPasswordRequired",
              })
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
    .mutation(async ({ ctx, input: { captcha, password, ...input } }) => {
      const receiver = asReceiver(input);
      const where = {
        phoneAreaCode_phone_deleteAt: {
          phoneAreaCode: input.phoneAreaCode,
          phone: input.phone,
          deleteAt: 0,
        },
      };

      const restaurantUser = await ctx.db.restaurantUser.findUnique({ where });
      if (!restaurantUser) {
        throw ACCOUNT_NOT_EXISTS_INCORRECT();
      }

      if (!restaurantUser.isEnabled) {
        throw ACCOUNT_DISABLED_INCORRECT();
      }
      const { id } = restaurantUser;

      const { verify: verifyCaptcha, clean: cleanCaptcha } = useCaptcha(
        CaptchaApp.RESTAURANT,
        CaptchaScene.FORGOT_PASSWORD,
        CaptchaChannel.SMS,
      );

      // 校验验证码
      const valid = await verifyCaptcha(receiver, captcha);
      if (!valid) {
        throw FORGOT_PASSWORD_CAPTCHA_INCORRECT();
      }
      // 验证码校验通过后，从 reids 删除
      await cleanCaptcha(receiver);

      await ctx.db.restaurantUser.update({
        where: { id },
        data: { password: await encodePassword(password.input) },
      });
    }),
});
