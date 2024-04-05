import { type RouterInputs, type RouterOutputs } from "~/trpc/shared";

export type PageRestaurantWalletPreRechargeBalanceInputs =
  RouterInputs["restaurantWalletPreRecharge"]["pageRestaurantWalletPreRechargeBalance"];
export type PageRestaurantWalletPreRechargeBalanceOutputs =
  RouterOutputs["restaurantWalletPreRecharge"]["pageRestaurantWalletPreRechargeBalance"]["record"][number];
export type PageTransationInputs =
  RouterInputs["restaurantWalletPreRecharge"]["pageTransation"];
export type PageTransationOutputs =
  RouterOutputs["restaurantWalletPreRecharge"]["pageTransation"]["record"][number];

export type AddRechargeInputs =
  RouterInputs["restaurantWalletPreRecharge"]["addRecharge"];
export type DeductRechargeInputs =
  RouterInputs["restaurantWalletPreRecharge"]["deductRecharge"];

export type PageRestaurantWalletPointsBalanceInputs =
  RouterInputs["restaurantWalletPoints"]["pageRestaurantWalletPointsBalance"];
export type PageRestaurantWalletPointsBalanceOutputs =
  RouterOutputs["restaurantWalletPoints"]["pageRestaurantWalletPointsBalance"]["record"][number];
export type PagePointsTransationInputs =
  RouterInputs["restaurantWalletPoints"]["pageTransation"];
export type PagePointsTransationOutputs =
  RouterOutputs["restaurantWalletPoints"]["pageTransation"]["record"][number];
