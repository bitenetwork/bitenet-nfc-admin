import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../../trpc";
import { asPagedResult } from "~/server/core/schema";
import {
  SignInPageResutlSchema,
  SignInQuery,
  onPageSignIn,
} from "~/server/customer/routers/nfc-sign-in/handler";

const PATH_PREFIX = "/nfc-sign-in";

export const TAG = "4000 - NFC签到";

export const nfcSignInRouter = createTRPCRouter({
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
      onPageSignIn({ ctx, input: { ...input, brandId: ctx.session.brandId } }),
    ),
});
