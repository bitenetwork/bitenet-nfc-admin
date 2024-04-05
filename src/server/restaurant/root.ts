import { createTRPCRouter } from "./trpc";
import {
  PhoneAreaCodeRouter,
  TAG as TAG_PHONE_AREA_CODE,
} from "./routers/phone-area-code";
import {
  RestaurantUserAuthRouter,
  TAG as TAG_RESTAURANT_USER_AUTH,
} from "./routers/restaurant-user-auth";
import {
  RestaurantUserRouter,
  TAG as TAG_RESTAURANT_USER,
} from "./routers/restaurant-user";
import {
  RestaurantUserManageRouter,
  TAG as TAG_RESTAURANT_USER_MANAGE,
} from "./routers/restaurant-user-manage";
import {
  RestaurantRegionRouter,
  TAG as TAG_RESTAURANT_REGION,
} from "./routers/restaurant-region";
import { RestaurantRouter, TAG as TAG_RESTAURANT } from "./routers/restaurant";
import {
  RestaurantNFCRouter,
  TAG as TAG_RESTAURANT_NFC,
} from "./routers/restaurant-nfc";
import { GiftRouter, TAG as TAG_GIFT } from "./routers/gift";
import {
  MemberGiftExchangeRouter,
  TAG as TAG_MEMBER_GIFT_EXCHANGE,
} from "./routers/member-gift-exchange";
import { ClockInRouter, TAG as TAG_CLOCK_IN } from "./routers/clock-in";
import { LuckyDrawRouter, TAG as TAG_LUCKY_DRAW } from "./routers/lucky-draw";
import {
  MemberLuckyDrawRouter,
  TAG as TAG_MEMBER_LUCKY_DRAW,
} from "./routers/member-lucky-draw";
import { InviteCodeRouter, TAG as TAG_INVITE } from "./routers/invite";
import {
  RestaurantMemberRouter,
  TAG as TAG_RESTAURANT_MEMBER,
} from "./routers/restaurant-member";
import {
  NotitficationRouter,
  TAG as TAG_NOTIFYCATION,
} from "./routers/notification/router";
import {
  globalConfigRouter,
  TAG as TAG_GLOBAL_CONFIG,
} from "./routers/global-config";
import {
  ResturantWalletPointsRouter,
  TAG as TAG_RESTAURANT_WALLET_POINTS,
} from "./routers/restaurant-wallet-points";
import {
  ResturantWalletPreRechargeRouter,
  TAG as TAG_RESTAURANT_WALLET_PRE_RECHARGE,
} from "./routers/restaurant-wallet-pre-recharge";
import {
  nfcSignInRouter,
  TAG as TAG_NFC_SIGN_IN,
} from "./routers/nfc-sign-in/router";
import {
  CuisineTypeRouter,
  TAG as TAG_CUISINE_TYPE,
} from "./routers/cuisine-type";
import { StatisticsRouter, TAG as TAG_STATISTICS } from "./routers/statistics";

export const ALL_TAG = [
  TAG_PHONE_AREA_CODE,
  TAG_RESTAURANT_USER_AUTH,
  TAG_RESTAURANT_USER,
  TAG_RESTAURANT_USER_MANAGE,
  TAG_RESTAURANT_REGION,
  TAG_RESTAURANT,
  TAG_RESTAURANT_NFC,
  TAG_GIFT,
  TAG_MEMBER_GIFT_EXCHANGE,
  TAG_CLOCK_IN,
  TAG_LUCKY_DRAW,
  TAG_MEMBER_LUCKY_DRAW,
  TAG_INVITE,
  TAG_RESTAURANT_MEMBER,
  TAG_NOTIFYCATION,
  TAG_RESTAURANT_WALLET_POINTS,
  TAG_RESTAURANT_WALLET_PRE_RECHARGE,
  TAG_GLOBAL_CONFIG,
  TAG_NFC_SIGN_IN,
  TAG_CUISINE_TYPE,
  TAG_STATISTICS,
];

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  phoneAreaCodeRouter: PhoneAreaCodeRouter,
  restaurantUserAuthRouter: RestaurantUserAuthRouter,
  restaurantUserRouter: RestaurantUserRouter,
  restaurantUserManageRouter: RestaurantUserManageRouter,
  restaurantRegionRouter: RestaurantRegionRouter,
  restaurantRouter: RestaurantRouter,
  restaurantNFCRouter: RestaurantNFCRouter,
  giftRouter: GiftRouter,
  memberGiftExchangeRouter: MemberGiftExchangeRouter,
  clockInRouter: ClockInRouter,
  luckyDrawRouter: LuckyDrawRouter,
  memberLuckyDrawRouter: MemberLuckyDrawRouter,
  inviteCodeRouter: InviteCodeRouter,
  restaurantMemberRouter: RestaurantMemberRouter,
  notitficationRouter: NotitficationRouter,
  resturantWalletPointsRouter: ResturantWalletPointsRouter,
  resturantWalletPreRechargeRouter: ResturantWalletPreRechargeRouter,
  globalConfigRouter: globalConfigRouter,
  nfcSignInRouter: nfcSignInRouter,
  cuisineTypeRouter: CuisineTypeRouter,
  statisticsRouter: StatisticsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
