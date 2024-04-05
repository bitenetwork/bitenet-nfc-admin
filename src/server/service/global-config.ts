import Decimal from "decimal.js";
import { AppRouterContext } from "~/server/core/schema";

export const findGlobalConfig = async ({ ctx }: { ctx: AppRouterContext }) => {
  const config = await ctx.db.globalConfig.findUnique({ where: { id: 1 } });
  if (!config) {
    return null;
  }
  return {
    ...config,
    bonusPointsRangeStart: upScale(config.bonusPointsRangeStart, 100),
    bonusPointsRangeEnd: upScale(config.bonusPointsRangeEnd, 100),
    appSignInBonus: upScale(config.appSignInBonus, 100),
    inviteBonus: upScale(config.inviteBonus, 100),
    pushFeeSms: upScale(config.pushFeeSms, 100),
    pushFeeApp: upScale(config.pushFeeApp, 100),
    luckyDrawCost: upScale(config.luckyDrawCost, 100),
  };
};

export const downScale = (n: number | Decimal, rouding: number) => {
  const a = new Decimal(n);
  const b = new Decimal(rouding);
  return a.mul(b).toNumber();
};

export const upScale = (n: number | undefined, rouding: number) => {
  if (!n) {
    return 0;
  }
  const a = new Decimal(n);
  const b = new Decimal(rouding);
  return a.div(b).toNumber();
};
