import { TRPCError } from "@trpc/server";
import { z } from "zod";
import _ from "lodash";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";
import { asAccount, asAccount as asReceiver } from "~/server/core/utils";

import {
  useCaptcha,
  CaptchaApp,
  CaptchaScene,
  CaptchaChannel,
} from "~/server/captcha";
import {
  MEMBER_NOT_EXIST,
  PHONE_HAD_BOUND,
  PHONE_NOT_REGISTER,
} from "../error";

const PATH_PREFIX = "/member/captcha";

const ReceiverInputSchema = z.object({
  phoneAreaCode: z
    .string({ required_error: "member:phoneAreaCode" })
    .describe("电话区号"),
  phone: z.string({ required_error: "member:phone" }).describe("电话号码"),
});

// 定义验证码接口出参
const CaptchaOutputSchema = z.object({
  app: z.nativeEnum(CaptchaApp).describe("应用"),
  scene: z.nativeEnum(CaptchaScene).describe("场景"),
  channel: z.nativeEnum(CaptchaChannel).describe("发送渠道"),
  receiver: z.string().describe("接收邮箱"),
  expireAt: z.date().describe("过期时间"),
});

const CaptchaChannelUsed = CaptchaChannel.SMS;

// Swagger 接口标签分组定义
export const TAG = "1001 - 会员 - 验证码";

export const memberCaptchaRouter = createTRPCRouter({
  // 需要登录鉴权的接口用protectedProcedure创建，不需要登录就能调用的接口用publicProcedure创建
  sendSignUpCode: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/send-sign-up-code`,
        tags: [TAG],
        summary: "发送注册验证码",
      },
    })
    // 入参定义
    .input(ReceiverInputSchema)
    // 出参定义
    .output(CaptchaOutputSchema)
    // 接口实现，POST 接口用mutation，GET 接口用 query
    .mutation(
      async ({
        ctx /** ctx为请求上下文，在../trpc文件的 createInnerTRPCContext 函数中注入，每个请求都会先执行 createInnerTRPCContext */,
        input /** 前面.input()定义的入参对象实例，前端传来的入参 */,
      }) => {
        const receiver = asReceiver(input);
        // 从数据查询账户对应用户
        const member = await ctx.db.member.findUnique({
          where: { account_deleteAt: { account: receiver, deleteAt: 0 } },
        });
        if (member) {
          // 用户存在则抛出异常
          throw PHONE_HAD_BOUND();
        }

        const { send: sendCaptcha } = useCaptcha(
          CaptchaApp.CUSTOMER,
          CaptchaScene.SIGN_UP,
          CaptchaChannelUsed,
        );

        return await sendCaptcha(receiver);
      },
    ),

  verifySignUpCode: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/verify-sign-up-code`,
        tags: [TAG],
        summary: "校验注册验证码",
      },
    })
    .input(
      ReceiverInputSchema.extend({
        captcha: z
          .string({ required_error: "member:verifySignUpCode" })
          .describe("验证码"),
      }),
    )
    .output(z.object({ valid: z.boolean() }))
    .mutation(async ({ ctx, input: { captcha, ...input } }) => {
      const receiver = asReceiver(input);
      const { verify: verifyCaptcha } = useCaptcha(
        CaptchaApp.CUSTOMER,
        CaptchaScene.SIGN_UP,
        CaptchaChannelUsed,
      );

      const valid = await verifyCaptcha(receiver, captcha);

      return {
        valid,
      };
    }),

  sendSignInCode: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/send-sign-in-code`,
        tags: [TAG],
        summary: "发送登录验证码",
      },
    })
    .input(ReceiverInputSchema)
    .output(CaptchaOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const receiver = asReceiver(input);
      const { send: sendCaptcha } = useCaptcha(
        CaptchaApp.CUSTOMER,
        CaptchaScene.SIGN_IN,
        CaptchaChannelUsed,
      );

      return await sendCaptcha(receiver);
    }),

  sendForgotPasswordCode: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/send-forgot-password-code`,
        tags: [TAG],
        summary: "发送忘记密码验证码",
      },
    })
    .input(ReceiverInputSchema)
    .output(CaptchaOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const receiver = asReceiver(input);
      const member = await ctx.db.member.findUnique({
        where: { account_deleteAt: { account: receiver, deleteAt: 0 } },
      });
      if (!member) {
        throw PHONE_NOT_REGISTER();
      }

      const { send: sendCaptcha } = useCaptcha(
        CaptchaApp.CUSTOMER,
        CaptchaScene.FORGOT_PASSWORD,
        CaptchaChannelUsed,
      );

      return await sendCaptcha(receiver);
    }),

  sendModifyPasswordCode: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/send-modify-password-code`,
        tags: [TAG],
        protect: true,
        summary: "发送修改密码验证码",
      },
    })
    .input(z.void())
    .output(CaptchaOutputSchema)
    .mutation(async ({ ctx }) => {
      const member = await ctx.db.member.findUnique({
        where: { id: ctx.session.userId },
      });

      if (!member) {
        throw MEMBER_NOT_EXIST();
      }
      const { account } = member;

      const { send: sendCaptcha } = useCaptcha(
        CaptchaApp.CUSTOMER,
        CaptchaScene.MODIFY_PASSWORD,
        CaptchaChannelUsed,
      );

      return await sendCaptcha(account);
    }),

  sendBindPhoneCode: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/send-bind-phone-code`,
        tags: [TAG],
        protect: true,
        summary: "发送绑定手机号验证码",
      },
    })
    .input(ReceiverInputSchema)
    .output(CaptchaOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const account = asAccount(input);

      const member = await ctx.db.member.findUnique({
        where: { account_deleteAt: { account, deleteAt: 0 } },
      });
      if (member) {
        // 用户存在则抛出异常
        throw PHONE_HAD_BOUND();
      }

      const { send: sendCaptcha } = useCaptcha(
        CaptchaApp.CUSTOMER,
        CaptchaScene.BIND_PHONE,
        CaptchaChannelUsed,
      );

      return await sendCaptcha(account);
    }),
});
