import { z } from "zod";
import _, { flatMap } from "lodash";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { SessionApp, useSession } from "~/server/session";
import {
  encodePassword,
  comparePassword,
  asAccount,
  getRandomInt,
} from "~/server/core/utils";

import {
  useCaptcha,
  CaptchaApp,
  CaptchaScene,
  CaptchaChannel,
} from "~/server/captcha";
import {
  ACCOUNT_OR_PASSWORD_INCORRECT,
  SIGN_UP_CAPTCHA_INCORRECT,
  SIGN_IN_CAPTCHA_INCORRECT,
  PHONE_HAD_BOUND,
  ACCOUNT_FREEZED,
} from "../error";
import { env } from "~/env.mjs";
import { UNEXPECT } from "~/server/core/error";
import { AppRouterContext } from "~/server/core/schema";
import wallet from "~/server/service/wallet";
import {
  WalletAccountType,
  WalletAccountOwner,
  InviteCode,
  OperatorType,
  MemberGiftExchangeType,
} from "@prisma/client";
import { upScale } from "~/server/service/global-config";

const PATH_PREFIX = "/member/auth";

// 定义注册接口入参
const MemberSignUpInputSchema = z.object({
  phoneAreaCode: z
    .string({ required_error: "member:phoneAreaCode" })
    .describe("电话区号"),
  phone: z.string({ required_error: "member:phone" }).describe("电话号码"),
  nickname: z.string().describe("昵称").nullish(),
  avatar: z.string().describe("头像URL地址").nullish(),
  gender: z
    .string()
    .describe("性别枚举: MALE 男性: FEMALE 女性: UNKNOWN 未知；")
    .nullish(),
  captcha: z
    .string({ required_error: "member:signUpCaptcha" })
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
    .refine(({ input, confirm }) => input === confirm, "member:passwordMatch")
    .nullish(),
  inviteCode: z.string().describe("邀请码").optional(),
  app: z.boolean().describe("是否app").default(false),
});

// 定义注册接口出参
const MemberSignUpOutputSchema = MemberSignUpInputSchema.omit({
  // 排除注册接口入参定义里的验证码，密码字段
  captcha: true,
  password: true,
  inviteCode: true,
}).extend({
  // 在注册接口入参定义基础上增加字段
  id: z.number().describe("主键"),
  createAt: z.date().describe("创建时间"),
  updateAt: z.date().describe("修改时间"),
  token: z.string().describe("登录令牌"),
  tokenExpire: z.date().describe("令牌过期时间"),
  phoneAreaCode: z.string().describe("电话区号").nullish(),
  phone: z.string().describe("电话号码").nullish(),
});

// 基于注册接口出参，定义登录接口出参
const MemberSignInByPasswordOutputSchema = MemberSignUpOutputSchema.extend({
  isSignUp: z.boolean().default(false).describe("是否新用户注册"),
  appSignInBonus: z.number().default(0).describe("app登录奖励"),
});

// 创建 Session 创建更新函数
const { update: updateSession, remove: removeSession } = useSession(
  SessionApp.CUSTOMER,
);

// Swagger 接口标签分组定义
export const TAG = "1000 - 会员 - 注册登录";

export const memberAuthRouter = createTRPCRouter({
  // 需要登录鉴权的接口用protectedProcedure创建，不需要登录就能调用的接口用publicProcedure创建
  signUp: publicProcedure
    .meta({
      openapi: {
        // Swagger 定义
        method: "POST",
        path: `${PATH_PREFIX}/sign-up`,
        tags: [TAG],
        summary: "用户注册接口",
      },
    })
    // 入参定义
    .input(MemberSignUpInputSchema)
    // 出参定义
    .output(MemberSignUpOutputSchema)
    // 接口实现，POST 接口用mutation，GET 接口用 query
    .mutation(
      async ({
        ctx /** ctx为请求上下文，在../trpc文件的 createInnerTRPCContext 函数中注入，每个请求都会先执行 createInnerTRPCContext */,
        input /** 前面.input(MemberSignUpInputSchema)定义的入参对象实例，前端传来的入参 */,
      }) => {
        // 创建验证码校验与清空函数
        const { verify: verifyCaptcha, clean: cleanCaptcha } = useCaptcha(
          CaptchaApp.CUSTOMER, // 应用为客户端
          CaptchaScene.SIGN_UP, // 场景为注册
          CaptchaChannel.SMS, // 验证码发送渠道为短信
        );

        const { captcha, password, ...rest } = input;
        const account = asAccount(input);

        // 校验注册验证码
        const valid = await verifyCaptcha(account, captcha);
        if (!valid) {
          throw SIGN_UP_CAPTCHA_INCORRECT();
        }
        // 验证码校验通过后，从 reids 删除
        await cleanCaptcha(account);

        const member = await ctx.db.member.findUnique({
          where: { account_deleteAt: { account, deleteAt: 0 } },
        });
        if (member) {
          // 用户存在则抛出异常
          throw PHONE_HAD_BOUND();
        }

        const data = {
          ...rest,
          account,
          // 密码用 bcrypt 算法加密
          password: password && (await encodePassword(password.input)),
        };

        // 数据库写入新用户
        const result = await ctx.db.member.create({ data });

        // 记录新用户与邀请人关系
        if (input.inviteCode) {
          await invited(ctx, result.id, input.inviteCode);
        }

        // 更新 Session 获取登录令牌
        const session = await updateSession({
          session: { userId: result.id, account: result.account },
        });

        const appSignInBonus = await appSignInBouns({
          ctx,
          memberId: result.id,
          app: input.app,
        });

        return {
          ...result,
          token: session.id,
          tokenExpire: session.expireAt,
          appSignInBonus,
        };
      },
    ),

  signInByPassword: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/sign-in-by-password`,
        tags: [TAG],
        summary: "用户密码登录",
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
        password: z
          .string({ required_error: "member:passwordInput" })
          .describe("密码"),
        app: z.boolean().describe("是否app").default(false),
      }),
    )
    .output(MemberSignInByPasswordOutputSchema)
    .mutation(async ({ ctx, input: { password, ...input } }) => {
      const account = asAccount(input);
      const member = await ctx.db.member.findUnique({
        where: { account_deleteAt: { account, deleteAt: 0 } },
      });

      if (!member) {
        throw ACCOUNT_OR_PASSWORD_INCORRECT();
      }

      if (!(await comparePassword(password, member))) {
        throw ACCOUNT_OR_PASSWORD_INCORRECT();
      }

      if (member.freeze) {
        throw ACCOUNT_FREEZED();
      }

      const session = await updateSession({
        session: { userId: member.id, account: member.account },
      });

      const appSignInBonus = await appSignInBouns({
        ctx,
        memberId: member.id,
        app: input.app,
      });

      const { password: _, ...rest } = member;
      return {
        ...rest,
        token: session.id,
        tokenExpire: session.expireAt,
        appSignInBonus,
      };
    }),

  signInByCaptcha: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/sign-in-by-captcha`,
        tags: [TAG],
        summary: "用户验证码登录",
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
          .string({ required_error: "member:signInCaptcha" })
          .describe("验证码"),
        inviteCode: z.string().describe("邀请码").optional(),
        app: z.boolean().describe("是否app").default(false),
      }),
    )
    .output(MemberSignInByPasswordOutputSchema)
    .mutation(async ({ ctx, input: { captcha, ...input } }) => {
      // 创建验证码校验与清空函数
      const { verify: verifyCaptcha, clean: cleanCaptcha } = useCaptcha(
        CaptchaApp.CUSTOMER, // 应用为客户端
        CaptchaScene.SIGN_IN, // 场景为注册
        CaptchaChannel.SMS, // 验证码发送渠道为短信
      );
      const account = asAccount(input);

      let member = await ctx.db.member.findUnique({
        where: { account_deleteAt: { account, deleteAt: 0 } },
      });

      const freepass = member?.freepass ?? false;

      if (freepass) {
        if ("000000" !== captcha) {
          throw SIGN_IN_CAPTCHA_INCORRECT();
        }
      } else {
        // 校验登录验证码
        const valid = freepass || (await verifyCaptcha(account, captcha));
        if (!valid) {
          throw SIGN_IN_CAPTCHA_INCORRECT();
        }
        // 验证码校验通过后，从 reids 删除
        await cleanCaptcha(account);
      }

      let isSignUp = false;

      if (!member) {
        const num = getRandomInt(0, 999999);
        const nickname = `Member${_.padStart(String(num), 6, "0")}`;
        const data = {
          nickname,
          account,
          phoneAreaCode: input.phoneAreaCode,
          phone: input.phone,
        };

        // 数据库写入新用户
        member = await ctx.db.member.create({ data });

        // 记录新用户与邀请人关系
        if (input.inviteCode) {
          await invited(ctx, member.id, input.inviteCode);
        }
        isSignUp = true;
      } else if (member.freeze) {
        throw ACCOUNT_FREEZED();
      }

      const session = await updateSession({
        session: { userId: member.id, account: member.account },
      });

      const appSignInBonus = await appSignInBouns({
        ctx,
        memberId: member.id,
        app: input.app,
      });

      const { password, ...rest } = member;
      return {
        ...rest,
        token: session.id,
        tokenExpire: session.expireAt,
        isSignUp,
        appSignInBonus,
      };
    }),

  logout: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/logout`,
        tags: [TAG],
        protect: true,
        summary: "退出登录",
      },
    })
    .input(z.void())
    .output(z.void())
    .mutation(async ({ ctx }) => {
      await removeSession(ctx.session.id);
    }),

  siginInWithInstagram: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/sign-in-with-instagram`,
        tags: [TAG],
        summary: "Instagram授权码登录",
      },
    })
    .input(
      z.object({
        redirectUri: z.string().describe("应用配置的重定向URI"),
        code: z.string().describe("instagram授权码"),
        nickname: z.string().describe("昵称").nullish(),
        avatar: z.string().describe("头像URL地址").nullish(),
        gender: z
          .string()
          .describe("性别枚举: MALE 男性: FEMALE 女性: UNKNOWN 未知；")
          .nullish(),
        inviteCode: z.string().describe("邀请码").optional(),
        app: z.boolean().describe("是否app").default(false),
      }),
    )
    .output(MemberSignUpOutputSchema)
    .mutation(
      async ({
        ctx,
        input: { redirectUri, code, nickname, avatar, gender, inviteCode, app },
      }) => {
        const url = "https://api.instagram.com/oauth/access_token";
        const payload = {
          client_id: env.INSTAGRAM_CLIENT_ID,
          client_secret: env.INSTAGRAM_CLIENT_SECRET,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
          code: code,
        };

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams(payload).toString(),
        });

        if (!response.ok) {
          const json = await response.json();
          throw UNEXPECT({ message: json.error_message });
        }
        const { user_id } = await response.json();

        const memberAuth = await ctx.db.memberAuth.findUnique({
          where: {
            appType_appId_userId: {
              appType: "INSTAGRAM",
              appId: env.INSTAGRAM_CLIENT_ID,
              userId: String(user_id),
            },
          },
        });

        if (memberAuth) {
          const member = await ctx.db.member.findUnique({
            where: { id: memberAuth.memberId },
          });

          if (!member) {
            throw ACCOUNT_OR_PASSWORD_INCORRECT();
          }

          if (member.freeze) {
            throw ACCOUNT_FREEZED();
          }

          const session = await updateSession({
            session: { userId: member.id, account: member.account },
          });

          return {
            ...member,
            token: session.id,
            tokenExpire: session.expireAt,
          };
        } else {
          const result = await ctx.db.member.create({
            data: {
              account: String(user_id),
              nickname,
              avatar,
              gender,
            },
          });

          await ctx.db.memberAuth.create({
            data: {
              appType: "INSTAGRAM",
              appId: env.INSTAGRAM_CLIENT_ID,
              userId: String(user_id),
              memberId: result.id,
            },
          });

          // 记录新用户与邀请人关系
          if (inviteCode) {
            await invited(ctx, result.id, inviteCode);
          }

          const session = await updateSession({
            session: { userId: result.id, account: result.account },
          });

          const appSignInBonus = await appSignInBouns({
            ctx,
            memberId: result.id,
            app,
          });

          const { password: _, ...rest } = result;
          return {
            ...rest,
            token: session.id,
            tokenExpire: session.expireAt,
            appSignInBonus,
          };
        }
      },
    ),

  siginInWithThirdpart: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/sign-in-with-thridpart`,
        tags: [TAG],
        summary: "第三方平台授权登录",
      },
    })
    .input(
      z.object({
        appType: z.string().describe("第三方平台标识"),
        userId: z.string().describe("第三方平台用户id"),
        nickname: z.string().describe("昵称").nullish(),
        avatar: z.string().describe("头像URL地址").nullish(),
        gender: z
          .string()
          .describe("性别枚举: MALE 男性: FEMALE 女性: UNKNOWN 未知；")
          .nullish(),
        inviteCode: z.string().describe("邀请码").optional(),
        app: z.boolean().describe("是否app").default(false),
      }),
    )
    .output(MemberSignUpOutputSchema)
    .mutation(
      async ({
        ctx,
        input: { appType, userId, nickname, avatar, gender, inviteCode, app },
      }) => {
        const memberAuth = await ctx.db.memberAuth.findUnique({
          where: {
            appType_appId_userId: {
              appType,
              appId: "0",
              userId,
            },
          },
        });

        if (memberAuth) {
          const member = await ctx.db.member.findUnique({
            where: { id: memberAuth.memberId },
          });

          if (!member) {
            throw ACCOUNT_OR_PASSWORD_INCORRECT();
          }

          const session = await updateSession({
            session: { userId: member.id, account: member.account },
          });

          return {
            ...member,
            token: session.id,
            tokenExpire: session.expireAt,
          };
        } else {
          const result = await ctx.db.member.create({
            data: {
              account: userId,
              nickname,
              avatar,
              gender,
            },
          });

          await ctx.db.memberAuth.create({
            data: {
              appType,
              appId: "0",
              userId,
              memberId: result.id,
            },
          });

          // 记录新用户与邀请人关系
          if (inviteCode) {
            await invited(ctx, result.id, inviteCode);
          }

          const session = await updateSession({
            session: { userId: result.id, account: result.account },
          });

          const appSignInBonus = await appSignInBouns({
            ctx,
            memberId: result.id,
            app,
          });

          const { password: _, ...rest } = result;
          return {
            ...rest,
            token: session.id,
            tokenExpire: session.expireAt,
            appSignInBonus,
          };
        }
      },
    ),
  updateAccessTime: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/update-access-time`,
        protect: true,
        tags: [TAG],
        summary: "更新会员最后访问时间",
      },
    })
    .input(z.void())
    .output(z.void())
    .mutation(async ({ ctx }) => {
      const id = ctx.session.userId;
      await ctx.db.member.update({
        data: {
          lastAccessTime: new Date(),
        },
        where: { id },
      });
    }),
});

const invited = async (
  ctx: AppRouterContext,
  memberId: number,
  code: string,
) => {
  const inviteCode = await ctx.db.inviteCode.findUnique({
    where: { code },
  });
  if (inviteCode) {
    if (!inviteCode.enabled) {
      return;
    }
    if (inviteCode.expireAt && new Date() >= inviteCode.expireAt) {
      return;
    }
    if (OperatorType.RESTAUARNT === inviteCode.operatorType) {
      await resturantInvite(ctx, memberId, inviteCode);
    } else if (OperatorType.CUSTOMER === inviteCode.operatorType) {
      await customerInvite(ctx, memberId, inviteCode);
    }
  }
};

const resturantInvite = async (
  ctx: AppRouterContext,
  memberId: number,
  inviteCode: InviteCode,
) => {
  await ctx.db.restaurantMemberRelation.upsert({
    create: {
      brandId: inviteCode.brandId,
      restaurantId: inviteCode.restaurantId,
      memberId,
      inviteCode: inviteCode.code,
      staffName: inviteCode.staffName,
    },
    update: {
      inviteCode: inviteCode.code,
      staffName: inviteCode.staffName,
    },
    where: {
      restaurantId_memberId_deleteAt: {
        restaurantId: inviteCode.restaurantId,
        memberId,
        deleteAt: 0,
      },
    },
  });
  await ctx.db.inviteCode.update({
    where: {
      id: inviteCode.id,
    },
    data: {
      invitees: {
        increment: 1,
      },
    },
  });

  const inviteGift = await ctx.db.inviteGift.findFirst({
    where: {
      inviteCodeId: inviteCode.id,
    },
  });
  if (inviteGift) {
    const gift = await ctx.db.gift.findUnique({
      where: { id: inviteGift.giftId },
    });
    if (gift) {
      await ctx.db.memberGiftExchange.create({
        data: {
          brandId: inviteCode.brandId,
          restaurantId: inviteCode.restaurantId,
          memberId,
          exchangeCost: 0,
          type: gift.type,
          exchangeGiftId: gift.id,
          exchangeGiftName: gift.name,
          exchangeGiftEn_name: gift.en_name,
          exchangeGiftPrice: gift.price,
          exchangeGiftPhoto: gift.photo,
          exchangeGiftDescription: gift.description,
          exchangeGiftEn_description: gift.en_description,
          exchangeType: MemberGiftExchangeType.RESTAUARNT_INVITE,
          quantity: inviteGift.giftAmount,
        },
      });
    }
  }
};

const customerInvite = async (
  ctx: AppRouterContext,
  memberId: number,
  inviteCode: InviteCode,
) => {
  const globalConfig = await ctx.db.globalConfig.findUnique({
    where: { id: 1 },
  });

  const inviterBonus = globalConfig?.inviteBonus ?? 500000;
  const inviteeBonus = globalConfig?.inviteBonus ?? 500000;
  const totalBonus = inviterBonus + inviteeBonus;

  const inviteMember = await ctx.db.inviteMember.create({
    data: {
      inviteCodeId: inviteCode.id,
      code: inviteCode.code,
      inviterMemberId: inviteCode.operatorId,
      inviteeMemberId: memberId,
      inviterBonus,
      inviteeBonus,
    },
  });

  const { getWallet, transferIn } = wallet(ctx as AppRouterContext);
  const inviterWalletAccount = await getWallet({
    walletType: WalletAccountType.MEMBER_POINTS,
    ownerType: WalletAccountOwner.MEMBER,
    ownerId: inviteCode.operatorId,
  });
  await transferIn(
    { account: inviterWalletAccount },
    {
      subject: "INVITER_BONUS",
      amount: inviterBonus,
      remark: "wallet:GetBounsByDoInvite",
      remarkEn: null,
      remarkI18n: true,
      voucherType: "INVITE_MEMBER",
      voucher: String(inviteMember.id),
    },
  );
  const inviteeWalletAccount = await getWallet({
    walletType: WalletAccountType.MEMBER_POINTS,
    ownerType: WalletAccountOwner.MEMBER,
    ownerId: memberId,
  });
  await transferIn(
    { account: inviteeWalletAccount },
    {
      subject: "INVITEE_BONUS",
      amount: inviteeBonus,
      remark: "wallet:GetBounsByBeInvited",
      remarkEn: null,
      remarkI18n: true,
      voucherType: "INVITE_MEMBER",
      voucher: String(inviteMember.id),
    },
  );

  await ctx.db.inviteCode.update({
    where: {
      id: inviteCode.id,
    },
    data: {
      invitees: {
        increment: 1,
      },
      inviteBonus: {
        increment: totalBonus,
      },
    },
  });
};

const appSignInBouns = async ({
  ctx,
  memberId,
  app,
}: {
  ctx: AppRouterContext;
  memberId: number;
  app: boolean;
}) => {
  const member = await ctx.db.member.findUnique({ where: { id: memberId } });
  if (!app || member?.appSignIn) {
    return;
  }
  if (!member) {
    return 0;
  }
  // 获取app登录奖励配置
  const globalConfig = await ctx.db.globalConfig.findUnique({
    where: { id: 1 },
  });
  if (!globalConfig) {
    return 0;
  }
  const { appSignInBonus } = globalConfig;

  const { getWallet, transferIn } = wallet(ctx as AppRouterContext);
  const walletAccount = await getWallet({
    walletType: WalletAccountType.MEMBER_POINTS,
    ownerType: WalletAccountOwner.MEMBER,
    ownerId: memberId,
  });
  await transferIn(
    { account: walletAccount },
    {
      subject: "APP_SIGN_IN_BONUS",
      amount: appSignInBonus,
      remark: "wallet:GetBounsBySignInInAPP",
      remarkEn: null,
      remarkI18n: true,
      voucherType: "APP_SIGN_IN_BONUS",
      voucher: "0",
    },
  );
  await ctx.db.member.update({
    data: { appSignIn: true },
    where: { id: member.id },
  });
  return upScale(appSignInBonus, walletAccount.rounding);
};
