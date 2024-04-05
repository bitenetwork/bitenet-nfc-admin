import { z } from "zod";
import _ from "lodash";
import {
  TRPCError,
  type inferRouterContext,
  type inferRouterInputs,
} from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/admin/trpc";
import { Prisma } from "@prisma/client";
import {
  AdminGetStatisticsSummaryInputsSchema,
  GetDailySignInLineChartInputsSchema,
  GetDailySignInLineChartOutputsSchema,
  GetStatisticsSummaryInputsSchema,
  GetStatisticsSummaryOutputsSchema,
  onAdminGetStatisticsSummary,
  onGetDailySignInLineChartInputs,
  onGetStatisticsSummary,
} from "~/server/restaurant/routers/statistics";
import { asPagedResult } from "~/server/core/schema";

type RouterContext = inferRouterContext<ReturnType<typeof createTRPCRouter>>;

interface CheckinRecord {
  period: string;
  count: number;
}

// 定义输入参数类型
const statisticsInputSchema = z.object({
  dateRangeStart: z.string().optional(),
  dateRangeEnd: z.string().optional(),
  dateRangeType: z.string().default("day"),
});

// 定义输出参数类型
const statisticsOutputSchema = z.object({
  restaurantCount: z.number().default(0),
  dailyNewRestaurants: z.number().default(0),
  memberCount: z.number().default(0),
  dailyNewMembers: z.number().default(0),
});

export const statisticsRouter = createTRPCRouter({
  getStatisticsCountData: protectedProcedure
    .input(z.object({}))
    .output(statisticsOutputSchema)
    .query(async ({ ctx: { db }, input }) => {
      let endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
      let startDate = new Date();
      startDate.setHours(0, 0, 0, 0);

      // 获取餐厅总数和当日新增的餐厅数量
      const totalRestaurants = await db.restaurant.count({
        where: { deleteAt: 0 },
      });
      const dailyNewRestaurants = await db.restaurant.count({
        where: {
          createAt: { gte: startDate, lte: endDate },
          deleteAt: 0,
        },
      });

      // 获取会员总数和当日新增的会员数量
      const totalMembers = await db.member.count({ where: { deleteAt: 0 } });
      const dailyNewMembers = await db.member.count({
        where: {
          createAt: { gte: startDate, lte: endDate },
          deleteAt: 0,
        },
      });

      return {
        restaurantCount: totalRestaurants,
        dailyNewRestaurants,
        memberCount: totalMembers,
        dailyNewMembers,
      };
    }),
  getStatisticsChatsData: protectedProcedure
    .input(statisticsInputSchema)
    .output(z.object({ dailyCheckins: z.any() }))
    .query(async ({ ctx: { db }, input }) => {
      let startDate = new Date(input.dateRangeStart || new Date());
      let endDate = new Date(input.dateRangeEnd || new Date());
      // 获取每日/每周/每月打卡数量
      let results;
      switch (input.dateRangeType) {
        case "week":
          // 按周分组的 SQL 查询
          results = await db.$queryRaw<
            CheckinRecord[]
          >`SELECT DATE_FORMAT(signInTime, '%X-%V') AS period, COUNT(*) as count
                                   FROM nfc_sign_in_record
                                   WHERE deleteAt = 0 AND signInTime BETWEEN ${startDate} AND ${endDate}
                                   GROUP BY period`;
          break;
        case "month":
          // 按月分组的 SQL 查询
          results = await db.$queryRaw<
            CheckinRecord[]
          >`SELECT DATE_FORMAT(signInTime, '%Y-%m') AS period, COUNT(*) as count
                                   FROM nfc_sign_in_record
                                   WHERE deleteAt = 0 AND signInTime BETWEEN ${startDate} AND ${endDate}
                                   GROUP BY period`;
          break;
        default: // 'day' or undefined
          // 按日分组的 SQL 查询
          results = await db.$queryRaw<
            CheckinRecord[]
          >`SELECT DATE(signInTime) AS period, COUNT(*) as count
                                   FROM nfc_sign_in_record
                                   WHERE deleteAt = 0 AND signInTime BETWEEN ${startDate} AND ${endDate}
                                   GROUP BY period`;
          break;
      }

      // 格式化结果
      const dailyCheckins = results.map((record) => ({
        date: record.period,
        value: record.count,
      }));

      return {
        dailyCheckins,
      };
    }),
  getWeeklySignInMemberCountList: protectedProcedure
    .input(
      z.object({
        yearStart: z.number(),
        monthStart: z.number(),
        yearEnd: z.number(),
        monthEnd: z.number(),
      }),
    )
    .query(
      async ({ ctx, input: { yearStart, monthStart, yearEnd, monthEnd } }) => {
        const querySql = Prisma.sql`
      SELECT year(signInTime) as year, month(signInTime) as month, week(signInTime) as week, count(distinct t.memberId) as count 
      FROM nfc_sign_in_record t
      WHERE year(signInTime) >= ${yearStart} and month(signInTime) >= ${monthStart} 
      and year(signInTime) <= ${yearEnd} and month(signInTime) <= ${monthEnd} 
      and deleteAt = 0
      group by year(signInTime), month(signInTime), week(signInTime)`;

        return (
          await ctx.db.$queryRaw<
            {
              year: number;
              month: number;
              week: number;
              count: number;
            }[]
          >(querySql)
        ).map(({ year, month, week, count }) => ({
          year: Number(year),
          month: Number(month),
          week: Number(week),
          count: Number(count),
        }));
      },
    ),
  getMonthSignInMemberCountList: protectedProcedure
    .input(
      z.object({
        yearStart: z.number(),
        monthStart: z.number(),
        yearEnd: z.number(),
        monthEnd: z.number(),
      }),
    )
    .query(
      async ({ ctx, input: { yearStart, monthStart, yearEnd, monthEnd } }) => {
        const querySql = Prisma.sql`
      SELECT year(signInTime) as year, month(signInTime) as month, count(distinct t.memberId) as count 
      FROM nfc_sign_in_record t
      WHERE year(signInTime) >= ${yearStart} and month(signInTime) >= ${monthStart} 
      and year(signInTime) <= ${yearEnd} and month(signInTime) <= ${monthEnd} 
      and deleteAt = 0
      group by year(signInTime), month(signInTime)`;

        return (
          await ctx.db.$queryRaw<
            {
              year: number;
              month: number;
              count: number;
            }[]
          >(querySql)
        ).map(({ year, month, count }) => ({
          year: Number(year),
          month: Number(month),
          count: Number(count),
        }));
      },
    ),
  getDailySignInLineChart: protectedProcedure
    .input(GetDailySignInLineChartInputsSchema)
    .output(asPagedResult(GetDailySignInLineChartOutputsSchema))
    .query(onGetDailySignInLineChartInputs),
  getStatisticsSummary: protectedProcedure
    .input(AdminGetStatisticsSummaryInputsSchema)
    .output(GetStatisticsSummaryOutputsSchema)
    .query(onAdminGetStatisticsSummary),
});
