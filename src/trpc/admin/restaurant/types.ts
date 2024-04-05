import { type RouterInputs, type RouterOutputs } from "~/trpc/shared";

// 品牌
export type CreateBrandInputs = RouterInputs["brand"]["createBrand"];
export type QueryBrandInputs = RouterInputs["brand"]["queryBrand"];
export type QueryBrandOutputs =
  RouterOutputs["brand"]["queryBrand"]["record"][number];

// 餐厅
export type CreateRestaurantInputs =
  RouterInputs["restaurant"]["createRestaurant"];
export type QueryRestaurantInputs =
  RouterInputs["restaurant"]["queryRestaurant"];
export type QueryRestaurantOutputs =
  RouterOutputs["restaurant"]["queryRestaurant"]["record"][number];

// 餐厅账号
export type CreateRestaurantUserInputs =
  RouterInputs["restaurantUser"]["createRestaurantUser"];
export type QueryRestaurantUserInputs =
  RouterInputs["restaurantUser"]["queryRestaurantUser"];
export type QueryRestaurantUserOutputs =
  RouterOutputs["restaurantUser"]["queryRestaurantUser"]["record"][number];

// 餐厅NFC
export type QueryRestaurantNFCInputs =
  RouterInputs["restaurantNFC"]["queryRestaurantNFC"];
export type QueryRestaurantNFCOutputs =
  RouterOutputs["restaurantNFC"]["queryRestaurantNFC"]["record"][number];

export type CuisineTypePageInputs =
  RouterInputs["cuisineType"]["pageCuisineType"];
export type CuisineTypePageResult =
  RouterOutputs["cuisineType"]["pageCuisineType"];
export type CuisineTypePageOutputs =
  RouterOutputs["cuisineType"]["pageCuisineType"]["record"][number];

export type CuisineTypeCreateInputs =
  RouterInputs["cuisineType"]["createCuisineType"];

export type CuisineTypeUpdateInputs =
  RouterInputs["cuisineType"]["updateCuisineType"]["data"];

export type GetDailySignInLineChartInputs =
  RouterInputs["statistics"]["getDailySignInLineChart"];
export type GetDailySignInLineChartOutputs =
  RouterOutputs["statistics"]["getDailySignInLineChart"];

export type GetStatisticsSummaryInputs =
  RouterInputs["statistics"]["getStatisticsSummary"];
export type GetStatisticsSummaryOutputs =
  RouterOutputs["statistics"]["getStatisticsSummary"];

export type RestaurantMemberPageMamberInputs =
  RouterInputs["restaurantMember"]["pageMember"];
export type RestaurantMemberPageMamberResult =
  RouterOutputs["restaurantMember"]["pageMember"];
export type RestaurantMemberPageMamberOutputs =
  RouterOutputs["restaurantMember"]["pageMember"]["record"][number];

export type RestaurantLatentMemberPageMamberInputs =
  RouterInputs["restaurantMember"]["pageRestaurantLatentMember"];
export type RestaurantLatentMemberPageMamberResult =
  RouterOutputs["restaurantMember"]["pageRestaurantLatentMember"];
export type RestaurantLatentMemberPageMamberOutputs =
  RouterOutputs["restaurantMember"]["pageRestaurantLatentMember"]["record"][number];
