import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../../trpc";
import { asPagedResult } from "~/server/core/schema";
import {
  SignInPageResutlSchema,
  SignInQuery,
  onPageSignIn,
} from "~/server/customer/routers/nfc-sign-in/handler";

export const nfcSignInRouter = createTRPCRouter({
  pageSignIn: protectedProcedure
    .input(SignInQuery)
    .output(asPagedResult(SignInPageResutlSchema))
    .query(onPageSignIn),
});
