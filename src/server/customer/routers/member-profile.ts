import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { z } from "zod";
import {
  CaptchaApp,
  CaptchaChannel,
  CaptchaScene,
  useCaptcha,
} from "~/server/captcha";
import _ from "lodash";
import { encodePassword, asAccount } from "~/server/core/utils";
import {
  FORGOT_PASSWORD_CAPTCHA_INCORRECT,
  MEMBER_NOT_EXIST,
  MODIFY_PASSWORD_CAPTCHA_INCORRECT,
  PHONE_HAD_BOUND,
} from "../error";
import {
  MemberLevelDefinitionSchema,
  MemberSchema,
} from "prisma/generated/zod";
import { getCurrentLevel } from "~/server/service/member-level";
import { SessionApp, useSession } from "~/server/session";

const PATH_PREFIX = "/member/profile";

// Swagger 接口标签分组定义
export const TAG = "1002 - 会员 - 个人信息";

const { remove: removeSession } = useSession(SessionApp.CUSTOMER);

export const memberProfileRouter = createTRPCRouter({
  // 需要登录鉴权的接口用protectedProcedure创建，不需要登录就能调用的接口用publicProcedure创建
  findCurrentMember: protectedProcedure
    .meta({
      // Swagger 定义
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/find-current-member`,
        tags: [TAG],
        protect: true, // 需要鉴权的接口需要加这个属性
        summary: "通过id获取会员用户信息",
      },
    })
    // 入参定义必须指定，没有参数的接口传入z.void()
    .input(z.void())
    // 指定出参定义，nullish表示出参可能是 null | undefined
    .output(MemberSchema.nullable())
    // 接口实现，POST 接口用mutation，GET 接口用 query
    .query(
      async ({
        ctx /** ctx为请求上下文，在../trpc文件的 createInnerTRPCContext 函数中注入，每个请求都会先执行 createInnerTRPCContext */,
      }) => {
        // ctx.db是createInnerTRPCContext中注入的 PrismaClient 对象，
        // ctx.db.member 是执行`yarn run postinstall`后 Prisma 根据 prisma/schema.prisma 文件中的表定义生成的 DAO 对象
        // 在 prisma/schema.prisma 文件中如何定义表结构 https://www.prisma.io/docs/concepts/components/prisma-schema/data-model
        // 在 prisma/schema.prisma 字段类型定义 https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#model-field-scalar-types
        // findUnique方法是 Prisma 的 CURD 方法之一，官方文档说明：https://www.prisma.io/docs/concepts/components/prisma-client/crud
        return await ctx.db.member.findUnique({
          where: { id: ctx.session.userId },
        });
      },
    ),

  updateMemberProfile: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/update-member-profile`,
        tags: [TAG],
        protect: true,
        summary: "修改当前会员个人信息",
      },
    })
    .input(
      z.object({
        nickname: z.string().describe("昵称").nullish(),
        avatar: z.string().describe("头像URL地址").nullish(),
        gender: z
          .string()
          .describe("性别枚举: MALE 男性: FEMALE 女性: UNKNOWN 未知；")
          .nullish(),
      }),
    )
    .output(MemberSchema)
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db.member.findUnique({
        where: { id: ctx.session.userId },
      });

      if (!member) {
        throw MEMBER_NOT_EXIST();
      }

      const { id } = member;

      return await ctx.db.member.update({
        where: { id },
        data: input,
      });
    }),

  updateMemberPassword: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/update-member-password`,
        tags: [TAG],
        protect: true,
        summary: "修改当前会员登录密码",
      },
    })
    .input(
      z.object({
        captcha: z
          .string({ required_error: "member:modifyPasswordCaptcha" })
          .describe("验证码"),
        password: z
          .object({
            input: z
              .string({ required_error: "member:passwordInput" })
              .describe("输入密码"),
            confirm: z
              .string({ required_error: "member:passwordConfirm" })
              .describe("确认密码"),
          })
          .refine(
            ({ input, confirm }) => input === confirm,
            "member:passwordMatch",
          ),
      }),
    )
    .output(z.void())
    .mutation(async ({ ctx, input: { captcha, password } }) => {
      const member = await ctx.db.member.findUnique({
        where: { id: ctx.session.userId },
      });

      if (!member) {
        throw MEMBER_NOT_EXIST();
      }
      const { id, account } = member;

      const { verify: verifyCaptcha, clean: cleanCaptcha } = useCaptcha(
        CaptchaApp.CUSTOMER, // 应用为客户端
        CaptchaScene.MODIFY_PASSWORD, // 场景为修改密码
        CaptchaChannel.SMS, // 验证码发送渠道为短信
      );

      // 校验验证码
      const valid = await verifyCaptcha(account, captcha);
      if (!valid) {
        throw MODIFY_PASSWORD_CAPTCHA_INCORRECT();
      }
      // 验证码校验通过后，从 reids 删除
      await cleanCaptcha(account);

      await ctx.db.member.update({
        where: { id },
        data: { password: await encodePassword(password.input) },
      });
    }),

  updateMemberForgotPassword: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/update-member-forgot-password`,
        tags: [TAG],
        summary: "修改忘记密码会员登录密码",
      },
    })
    .input(
      z.object({
        phoneAreaCode: z
          .string({ required_error: "member:phoneAreaCode" })
          .describe("电话区号"),
        phone: z
          .string({ required_error: "member:phone" })
          .describe("电话号码"),
        captcha: z
          .string({ required_error: "member:forgotPasswordCaptcha" })
          .describe("验证码"),
        password: z
          .object({
            input: z
              .string({ required_error: "member:forgotPasswordCaptcha" })
              .describe("输入密码"),
            confirm: z
              .string({ required_error: "member:passwordConfirm" })
              .describe("确认密码"),
          })
          .refine(
            ({ input, confirm }) => input === confirm,
            "member:passwordMatch",
          ),
      }),
    )
    .output(z.void())
    .mutation(async ({ ctx, input: { captcha, password, ...input } }) => {
      const account = asAccount(input);
      const member = await ctx.db.member.findUnique({
        where: { account_deleteAt: { account, deleteAt: 0 } },
      });

      if (!member) {
        throw MEMBER_NOT_EXIST();
      }
      const { id } = member;

      const { verify: verifyCaptcha, clean: cleanCaptcha } = useCaptcha(
        CaptchaApp.CUSTOMER, // 应用为客户端
        CaptchaScene.FORGOT_PASSWORD, // 场景为忘记密码
        CaptchaChannel.SMS, // 验证码发送渠道为短信
      );

      // 校验验证码
      const valid = await verifyCaptcha(account, captcha);
      if (!valid) {
        throw FORGOT_PASSWORD_CAPTCHA_INCORRECT();
      }
      // 验证码校验通过后，从 reids 删除
      await cleanCaptcha(account);

      await ctx.db.member.update({
        where: { id },
        data: { password: await encodePassword(password.input) },
      });
    }),

  bindPhone: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/bind-phone`,
        tags: [TAG],
        summary: "绑定手机号",
        protect: true,
      },
    })
    .input(
      z.object({
        phoneAreaCode: z
          .string({ required_error: "member:phoneAreaCode" })
          .describe("电话区号"),
        phone: z
          .string({ required_error: "member:phone" })
          .describe("电话号码"),
        captcha: z
          .string({ required_error: "member:forgotPasswordCaptcha" })
          .describe("验证码"),
      }),
    )
    .output(MemberSchema)
    .mutation(async ({ ctx, input }) => {
      const { phoneAreaCode, phone, captcha } = input;
      const account = asAccount(input);

      const existed = await ctx.db.member.findUnique({
        where: { account_deleteAt: { account, deleteAt: 0 } },
      });
      if (existed) {
        // 用户存在则抛出异常
        throw PHONE_HAD_BOUND();
      }

      const member = await ctx.db.member.findUnique({
        where: { id: ctx.session.userId },
      });

      if (!member) {
        throw MEMBER_NOT_EXIST();
      }
      const { id } = member;

      const { verify: verifyCaptcha, clean: cleanCaptcha } = useCaptcha(
        CaptchaApp.CUSTOMER, // 应用为客户端
        CaptchaScene.BIND_PHONE, // 场景为忘记密码
        CaptchaChannel.SMS, // 验证码发送渠道为短信
      );

      // 校验验证码
      const valid = await verifyCaptcha(account, captcha);
      if (!valid) {
        throw FORGOT_PASSWORD_CAPTCHA_INCORRECT();
      }
      // 验证码校验通过后，从 reids 删除
      await cleanCaptcha(account);

      return await ctx.db.member.update({
        data: {
          account,
          phoneAreaCode,
          phone,
        },
        where: { id },
      });
    }),

  deleteAccount: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/delete-account`,
        tags: [TAG],
        summary: "删除账号",
        protect: true,
      },
    })
    .input(z.void())
    .output(MemberSchema.optional())
    .mutation(async ({ ctx }) => {
      const id = ctx.session.userId;
      const existed = await ctx.db.member.findUnique({ where: { id } });
      if (!existed) {
        return;
      }
      await ctx.db.member.delete({ where: { id } });
      removeSession(ctx.session.id);
      return existed;
    }),
});
