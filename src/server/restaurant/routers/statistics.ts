import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import {
  AppRouterContext,
  asPageable,
  asPagedResult,
} from "~/server/core/schema";
import { Prisma, WalletAccountOwner, WalletAccountType } from "@prisma/client";
import wallet from "~/server/service/wallet";
import { UNEXPECT } from "~/server/core/error";
import { addDaysToDate } from "~/server/core/utils";
import { upScale } from "~/server/service/global-config";
import Decimal from "decimal.js";

const PATH_PREFIX = "/statistics";

export const TAG = "8000 - 统计分析";

const GetSignInLineChartInputsSchema = asPageable(
  z.object({
    startDate: z.date().describe("查询日期区间 - 开始时间").optional(),
    endDate: z.date().describe("查询日期区间 - 结束时间").optional(),
  }),
);
type GetSignInLineChartInputs = z.infer<typeof GetSignInLineChartInputsSchema>;

const GetSignInLineChartOutputsSchema = z.object({
  year: z.number().describe("年份"),
  month: z.number().describe("月份"),
  recordCount: z.string().describe("数量"),
});
type GetSignInLineChartOutputs = z.infer<
  typeof GetSignInLineChartOutputsSchema
>;

const onGetSignInLineChartInputs = async ({
  ctx,
  input: { page, pageSize, startDate, endDate },
}: {
  ctx: AppRouterContext;
  input: GetSignInLineChartInputs;
}) => {
  const { brandId } = ctx.session;
  const skip = (page - 1) * pageSize;
  const take = pageSize;

  const condition = Prisma.sql` and brandId = ${brandId} and deleteAt = 0
  ${startDate ? Prisma.sql`and signInTime >= ${startDate}` : Prisma.empty}
  ${endDate ? Prisma.sql`and signInTime <= ${endDate}` : Prisma.empty}
  `;

  const statisticsSql = Prisma.sql`
  SELECT 
    YEAR(signInTime) AS year, 
    MONTH(signInTime) AS month, 
    COUNT(*) AS recordCount
  FROM 
      nfc_sign_in_record t
  WHERE 
      deleteAt = 0 ${condition}
  GROUP BY 
      YEAR(signInTime), 
      MONTH(signInTime)
  ORDER BY 
      YEAR(signInTime) DESC, 
      MONTH(signInTime) DESC
  `;

  const countSql = Prisma.sql`
  select count(*) as totalCount
  from (${statisticsSql}) t`;

  const pageSql = Prisma.sql`${statisticsSql} LIMIT ${skip}, ${take}`;

  const totalCount = Number(
    (await ctx.db.$queryRaw<{ totalCount: bigint }[]>(countSql))[0]
      ?.totalCount ?? 0n,
  );
  const pageCount = Math.ceil(totalCount / pageSize);

  const record =
    totalCount > 0
      ? await ctx.db.$queryRaw<GetSignInLineChartOutputs[]>(pageSql)
      : [];

  record.forEach((x) => (x.recordCount = String(x.recordCount)));

  return {
    page,
    pageSize,
    pageCount,
    totalCount,
    record,
  };
};

export const GetDailySignInLineChartInputsSchema = asPageable(
  z.object({
    startDate: z.date().describe("查询日期区间 - 开始时间").optional(),
    endDate: z.date().describe("查询日期区间 - 结束时间").optional(),
    brandId: z.number().describe("品牌ID").optional(),
  }),
);
type GetDailySignInLineChartInputs = z.infer<
  typeof GetDailySignInLineChartInputsSchema
>;

export const GetDailySignInLineChartOutputsSchema = z.object({
  date: z.string().describe("日期"),
  recordCount: z.number().describe("数量"),
});
type GetDailySignInLineChartOutputs = z.infer<
  typeof GetDailySignInLineChartOutputsSchema
>;

export const onGetDailySignInLineChartInputs = async ({
  ctx,
  input: { page, pageSize, startDate, endDate, ...rest },
}: {
  ctx: AppRouterContext;
  input: GetDailySignInLineChartInputs;
}) => {
  const brandId = rest.brandId ?? ctx.session.brandId;
  const skip = (page - 1) * pageSize;
  const take = pageSize;

  const condition = Prisma.sql` and brandId = ${brandId} and deleteAt = 0
  ${startDate ? Prisma.sql`and signInTime >= ${startDate}` : Prisma.empty}
  ${endDate ? Prisma.sql`and signInTime <= ${endDate}` : Prisma.empty}
  `;

  const statisticsSql = Prisma.sql`
  SELECT 
    DATE_FORMAT(signInTime, '%Y-%m-%d') AS date,
    COUNT(*) AS recordCount
  FROM 
      nfc_sign_in_record t
  WHERE 
      deleteAt = 0 ${condition}
  GROUP BY 
      date
  ORDER BY 
      date
  `;

  const countSql = Prisma.sql`
  select count(*) as totalCount
  from (${statisticsSql}) t`;

  const pageSql = Prisma.sql`${statisticsSql} LIMIT ${skip}, ${take}`;

  const totalCount = Number(
    (await ctx.db.$queryRaw<{ totalCount: bigint }[]>(countSql))[0]
      ?.totalCount ?? 0n,
  );
  const pageCount = Math.ceil(totalCount / pageSize);

  const record =
    totalCount > 0
      ? await ctx.db.$queryRaw<GetDailySignInLineChartOutputs[]>(pageSql)
      : [];

  record.forEach((x) => (x.recordCount = Number(x.recordCount)));

  return {
    page,
    pageSize,
    pageCount,
    totalCount,
    record,
  };
};

export const GetStatisticsSummaryInputsSchema = z.void();
type GetStatisticsSummaryInputs = z.infer<
  typeof GetStatisticsSummaryInputsSchema
>;

export const GetStatisticsSummaryOutputsSchema = z.object({
  totalSnap: z.number().describe("snap总额"),
  weekSnap: z.number().describe("本周snap"),
  lastWeekSnap: z.number().describe("上周snap"),
  snapPercentage: z.string().describe("snap变化比例"),
  totalSignInCount: z.number().describe("总签到数"),
  weekSignInCount: z.number().describe("本周签到数"),
  lastWeekSignInCount: z.number().describe("上周签到数"),
  signInCountPercentage: z.string().describe("签到变化比例"),
  balance: z.number().describe("充值余额"),
});
type GetStatisticsSummaryOutputs = z.infer<
  typeof GetStatisticsSummaryOutputsSchema
>;

export const onGetStatisticsSummary = async ({
  ctx,
  input,
}: {
  ctx: AppRouterContext;
  input: GetStatisticsSummaryInputs;
}) => {
  const { brandId } = ctx.session;
  if (!brandId) {
    throw UNEXPECT();
  }

  const weekEnd = new Date();
  weekEnd.setHours(0, 0, 0, 0);
  const weekStart = addDaysToDate(weekEnd, -6);
  const lastWeekEnd = addDaysToDate(weekStart, -1);
  const lastWeekStart = addDaysToDate(lastWeekEnd, -6);

  const snapStatistics = await getSnapStatistics({
    ctx,
    input: { brandId, weekStart, weekEnd, lastWeekStart, lastWeekEnd },
  });
  const signInRecordStatistics = await getSignInRecordStatistics({
    ctx,
    input: { brandId, weekStart, weekEnd, lastWeekStart, lastWeekEnd },
  });

  return {
    ...snapStatistics,
    ...signInRecordStatistics,
  };
};

export const AdminGetStatisticsSummaryInputsSchema = z.object({
  brandId: z.number().describe("品牌id").optional(),
});
type AdminGetStatisticsSummaryInputs = z.infer<
  typeof AdminGetStatisticsSummaryInputsSchema
>;

export const onAdminGetStatisticsSummary = async ({
  ctx,
  input,
}: {
  ctx: AppRouterContext;
  input: AdminGetStatisticsSummaryInputs;
}) => {
  const brandId = input.brandId;
  if (!brandId) {
    throw UNEXPECT();
  }

  const weekEnd = new Date();
  weekEnd.setHours(0, 0, 0, 0);
  const weekStart = addDaysToDate(weekEnd, -6);
  const lastWeekEnd = addDaysToDate(weekStart, -1);
  const lastWeekStart = addDaysToDate(lastWeekEnd, -6);

  const snapStatistics = await getSnapStatistics({
    ctx,
    input: { brandId, weekStart, weekEnd, lastWeekStart, lastWeekEnd },
  });
  const signInRecordStatistics = await getSignInRecordStatistics({
    ctx,
    input: { brandId, weekStart, weekEnd, lastWeekStart, lastWeekEnd },
  });

  return {
    ...snapStatistics,
    ...signInRecordStatistics,
  };
};

const getSnapStatistics = async ({
  ctx,
  input,
}: {
  ctx: AppRouterContext;
  input: {
    brandId: number;
    weekStart: Date;
    weekEnd: Date;
    lastWeekStart: Date;
    lastWeekEnd: Date;
  };
}) => {
  const { brandId, weekStart, weekEnd, lastWeekStart, lastWeekEnd } = input;
  const { getWallet, getBalance } = wallet(ctx);
  const fixedCondition = {
    walletType: WalletAccountType.MEMBER_POINTS,
    ownerType: WalletAccountOwner.RESTAUARNT,
    ownerId: brandId,
  };
  const pointsWallet = await getWallet({
    ...fixedCondition,
  });

  const totalSnap = await getBalance({
    ...fixedCondition,
  });

  const weekSnap = await getRecentDaysBalanceChange({
    ctx,
    input: { ...fixedCondition, startDate: weekStart, endDate: weekEnd },
  });

  const lastWeekSnap = await getRecentDaysBalanceChange({
    ctx,
    input: {
      ...fixedCondition,
      startDate: lastWeekStart,
      endDate: lastWeekEnd,
    },
  });

  let snapPercentage = "0";
  if (weekSnap === 0 && lastWeekSnap === 0) {
    snapPercentage = "0";
  } else if (lastWeekSnap === 0) {
    snapPercentage = "1";
  } else {
    snapPercentage = new Decimal(weekSnap)
      .minus(new Decimal(lastWeekSnap))
      .div(new Decimal(lastWeekSnap))
      .toString();
  }

  const rechargeWallet = await getWallet({
    walletType: WalletAccountType.RESTAUARNT_PRE_RECHARGE,
    ownerType: WalletAccountOwner.RESTAUARNT,
    ownerId: brandId,
  });
  const balance = await getBalance({
    walletType: WalletAccountType.RESTAUARNT_PRE_RECHARGE,
    ownerType: WalletAccountOwner.RESTAUARNT,
    ownerId: brandId,
  });

  return {
    balance: upScale(balance, rechargeWallet.rounding),
    totalSnap: upScale(totalSnap, pointsWallet.rounding),
    weekSnap: upScale(weekSnap, pointsWallet.rounding),
    lastWeekSnap: upScale(lastWeekSnap, pointsWallet.rounding),
    snapPercentage,
  };
};

const getRecentDaysBalanceChange = async ({
  ctx,
  input,
}: {
  ctx: AppRouterContext;
  input: {
    walletType: WalletAccountType;
    ownerType: WalletAccountOwner;
    ownerId: number;
    startDate: Date;
    endDate: Date;
  };
}) => {
  const { startDate, endDate, ...rest } = input;
  const where = {
    ...rest,
    createAt: {
      gte: startDate,
      lt: addDaysToDate(endDate, 1),
    },
  };
  const lastTrans = await ctx.db.walletTransation.findFirst({
    where,
    orderBy: {
      createAt: "desc",
    },
  });
  const firstTrans = await ctx.db.walletTransation.findFirst({
    where,
    orderBy: {
      createAt: "asc",
    },
  });
  return (lastTrans?.balanceAfter ?? 0) - (firstTrans?.balanceAfter ?? 0);
};

const getSignInRecordStatistics = async ({
  ctx,
  input,
}: {
  ctx: AppRouterContext;
  input: {
    brandId: number;
    weekStart: Date;
    weekEnd: Date;
    lastWeekStart: Date;
    lastWeekEnd: Date;
  };
}) => {
  const { brandId, weekStart, weekEnd, lastWeekStart, lastWeekEnd } = input;

  const totalSignInCount = await ctx.db.nfcSignInRecord.count({
    where: {
      brandId,
    },
  });

  const weekSignInCount = await ctx.db.nfcSignInRecord.count({
    where: {
      brandId,
      signInTime: {
        gte: weekStart,
        lt: addDaysToDate(weekEnd, 1),
      },
    },
  });

  const lastWeekSignInCount = await ctx.db.nfcSignInRecord.count({
    where: {
      brandId,
      signInTime: {
        gte: lastWeekStart,
        lt: addDaysToDate(lastWeekEnd, 1),
      },
    },
  });

  let signInCountPercentage = "0";
  if (weekSignInCount === 0 && lastWeekSignInCount === 0) {
    signInCountPercentage = "0";
  } else if (lastWeekSignInCount === 0) {
    signInCountPercentage = "1";
  } else {
    signInCountPercentage = new Decimal(weekSignInCount)
      .minus(new Decimal(lastWeekSignInCount))
      .div(new Decimal(lastWeekSignInCount))
      .toString();
  }

  return {
    totalSignInCount,
    weekSignInCount,
    lastWeekSignInCount,
    signInCountPercentage,
  };
};

export const StatisticsRouter = createTRPCRouter({
  getSignInLineChart: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/get-sign-in-line-chart`,
        tags: [TAG],
        protect: true,
        summary: "获取签到折线图",
      },
    })
    .input(GetSignInLineChartInputsSchema)
    .output(asPagedResult(GetSignInLineChartOutputsSchema))
    .mutation(onGetSignInLineChartInputs),
  getDailySignInLineChartInputs: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/get-daily-sign-in-line-chart`,
        tags: [TAG],
        protect: true,
        summary: "获取签到折线图(统计每天)",
      },
    })
    .input(GetDailySignInLineChartInputsSchema)
    .output(asPagedResult(GetDailySignInLineChartOutputsSchema))
    .mutation(onGetDailySignInLineChartInputs),
  getStatisticsSummary: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/get-statistics-summary`,
        tags: [TAG],
        protect: true,
        summary: "获取汇总统计",
      },
    })
    .input(GetStatisticsSummaryInputsSchema)
    .output(GetStatisticsSummaryOutputsSchema)
    .mutation(onGetStatisticsSummary),
});
