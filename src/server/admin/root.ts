import { sysUserRouter } from "~/server/admin/routers/sys-user";
import { restaurantRouter } from "~/server/admin/routers/restaurant";
import { restaurantRegionRouter } from "~/server/admin/routers/restaurant-region";
import { createTRPCRouter } from "~/server/admin/trpc";
import { brandRouter } from "./routers/brand";
import { restaurantUserRouter } from "./routers/restaurant-user";
import { restaurantWalletPreRechargeRouter } from "./routers/restaurant-wallet-pre-recharge";
import { restaurantWalletPointsRouter } from "./routers/restaurant-wallet-points";
import { globalConfigRouter } from "./routers/global-config";
import { SmsPushRecordRouter } from "./routers/sms-push-record";
import { statisticsRouter } from "./routers/statistics";
import { restaurantNFCRouter } from "./routers/restaurant-nfc";
import { MemberRouter } from "./routers/member";
import { NotitficationRouter } from "./routers/notification/router";
import { CuisineTypeRouter } from "./routers/cuisine-type";
import { MemberWalletPointsRouter } from "./routers/member-wallet-points";
import { nfcSignInRouter } from "./routers/nfc-sign-in/router";
import { restaurantMemberRouter } from "./routers/restaurant-member";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  sysUser: sysUserRouter,
  brand: brandRouter,
  restaurant: restaurantRouter,
  restaurantRegion: restaurantRegionRouter,
  restaurantUser: restaurantUserRouter,
  restaurantMember: restaurantMemberRouter,
  restaurantWalletPreRecharge: restaurantWalletPreRechargeRouter,
  restaurantWalletPoints: restaurantWalletPointsRouter,
  globalConfig: globalConfigRouter,
  smsPushRecord: SmsPushRecordRouter,
  statistics: statisticsRouter,
  restaurantNFC: restaurantNFCRouter,
  member: MemberRouter,
  notitfication: NotitficationRouter,
  memberWalletPoints: MemberWalletPointsRouter,
  cuisineType: CuisineTypeRouter,
  nfcSignInRouter: nfcSignInRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
