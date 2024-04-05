import {
  memberAuthRouter,
  TAG as TAG_MEMBER_AUTH,
} from "./routers/member-auth";
import {
  memberCaptchaRouter,
  TAG as TAG_MEMBER_CAPTCHA,
} from "./routers/member-captcha";
import {
  memberProfileRouter,
  TAG as TAG_MEMBER_PROFILE,
} from "./routers/member-profile";
import {
  phoneAreaCodeRouter,
  TAG as TAG_PHONE_AREA_CODE,
} from "./routers/phone-area-code";
import { pushingRouter, TAG as TAG_PUSHINGH } from "./routers/pushing";
import {
  notificationRouter,
  TAG as TAG_NOTIFICATION,
} from "./routers/notification";
import {
  memberWalletRouter,
  TAG as TAG_MEMBER_WALLET,
} from "./routers/member-wallet";
import {
  globalConfigRouter,
  TAG as TAG_GLOBAL_CONFIG,
} from "./routers/global-config";
import {
  nfcSignInRouter,
  TAG as TAG_NFC_SIGN_IN,
} from "./routers/nfc-sign-in/router";

import { luckyDrawRouter, TAG as TAG_LUCKY_DRAW } from "./routers/lucky-draw";
import {
  memberLuckyDrawRouter,
  TAG as TAG_MEMBER_LUCKY_DRAW,
} from "./routers/member-lucky-draw";
import { giftRouter, TAG as TAG_GIFT } from "./routers/gift";
import {
  memberGiftExchangeRouter,
  TAG as TAG_MEMBER_GIFT_EXCHANGE,
} from "./routers/member-gift-exchange";
import { brandRouter, TAG as TAG_BRAND } from "./routers/brand";
import { restaurantRouter, TAG as TAG_RESTAURANT } from "./routers/restaurant";
import { clockInRouter, TAG as TAG_CLOCK_IN } from "./routers/clock-in";
import { inviteCodeRouter, TAG as TAG_INVITE } from "./routers/invite";

import { createTRPCRouter } from "./trpc";

export const ALL_TAG = [
  TAG_MEMBER_AUTH,
  TAG_MEMBER_CAPTCHA,
  TAG_MEMBER_PROFILE,
  TAG_PHONE_AREA_CODE,
  TAG_PUSHINGH,
  TAG_NOTIFICATION,
  TAG_MEMBER_WALLET,
  TAG_GLOBAL_CONFIG,
  TAG_NFC_SIGN_IN,
  TAG_LUCKY_DRAW,
  TAG_MEMBER_LUCKY_DRAW,
  TAG_GIFT,
  TAG_MEMBER_GIFT_EXCHANGE,
  TAG_BRAND,
  TAG_RESTAURANT,
  TAG_CLOCK_IN,
  TAG_INVITE,
];

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  memberAuth: memberAuthRouter,
  memberCaptcha: memberCaptchaRouter,
  memberProfile: memberProfileRouter,
  phoneAreaCode: phoneAreaCodeRouter,
  pushing: pushingRouter,
  notification: notificationRouter,
  memberWallet: memberWalletRouter,
  globalConfig: globalConfigRouter,
  nfcSignIn: nfcSignInRouter,
  luckyDrawRouter: luckyDrawRouter,
  memberLuckyDrawRouter: memberLuckyDrawRouter,
  giftRouter: giftRouter,
  memberGiftExchangeRouter: memberGiftExchangeRouter,
  brandRouter: brandRouter,
  restaurantRouter: restaurantRouter,
  clockInRouter: clockInRouter,
  inviteCode: inviteCodeRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
