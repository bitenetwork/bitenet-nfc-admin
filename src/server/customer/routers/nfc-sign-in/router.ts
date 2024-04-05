import { createTRPCRouter, protectedProcedure } from "../../trpc";
import {
  GetNextClockInGiftInfoInputsSchema,
  GetNextClockInGiftInfoOutputsSchema,
  SignInInputs,
  SignInOutputs,
  SignInPageResutlSchema,
  SignInQuery,
  onGetNextClockInGiftInfo,
  onPageSignIn,
  onSignIn,
} from "./handler";
import { asPagedResult } from "~/server/core/schema";

const PATH_PREFIX = "/nfc-sign-in";

export const TAG = "4000 - NFC签到";

export const nfcSignInRouter = createTRPCRouter({
  getNextClockInGiftInfo: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/get-next-clock-in-gift-info`,
        tags: [TAG],
        protect: true,
        summary: "获取下一个打卡目标礼物信息",
      },
    })
    .input(GetNextClockInGiftInfoInputsSchema)
    .output(GetNextClockInGiftInfoOutputsSchema.nullable())
    .query(onGetNextClockInGiftInfo),
  signIn: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/sign-in`,
        tags: [TAG],
        protect: true,
        summary: "创建会员签到记录",
      },
    })
    .input(SignInInputs)
    .output(SignInOutputs)
    .mutation(onSignIn),
  pageSignIn: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/page-sign-in`,
        tags: [TAG],
        protect: true,
        summary: "分页查询会员签到记录",
      },
    })
    .input(SignInQuery)
    .output(asPagedResult(SignInPageResutlSchema))
    .mutation(async ({ ctx, input }) =>
      onPageSignIn({ ctx, input: { ...input, memberId: ctx.session.userId } }),
    ),
});
