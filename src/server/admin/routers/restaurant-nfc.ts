import { z } from "zod";
import _ from "lodash";
import {
  TRPCError,
  type inferRouterContext,
  type inferRouterInputs,
} from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/admin/trpc";

type RouterContext = inferRouterContext<ReturnType<typeof createTRPCRouter>>;

export const restaurantNFCRouter = createTRPCRouter({
  // 分页查询
  queryRestaurantNFC: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        pageSize: z.number().default(30),
        restaurantId: z.number().optional(),
      }),
    )
    .query(async ({ ctx, input: { page, pageSize, ...input } }) => {
      const where = {
        restaurantId: input.restaurantId,
      };

      const total = await ctx.db.restaurantNFC.count({ where });
      const totalPage = Math.ceil(total / pageSize);
      const record =
        total > 0
          ? await ctx.db.restaurantNFC.findMany({
              skip: (page - 1) * pageSize,
              take: pageSize,
              where,
            })
          : [];
      const restaurantMap = new Map();
      if (record.length > 0) {
        const restaurantIds = record.map((item) => item.restaurantId);
        const restaurants = await ctx.db.restaurant.findMany({
          where: { id: { in: restaurantIds } },
        });
        for (const restaurant of restaurants) {
          restaurantMap.set(restaurant.id, restaurant.name);
        }
      }
      return {
        page,
        pageSize,
        total,
        totalPage,
        record: record.map((restaurantNFC) => ({
          ...restaurantNFC,
          restaurantName: restaurantMap.get(restaurantNFC.restaurantId), // 添加餐厅名称字段
        })),
      };
    }),
});
