import { z } from "zod";
import _ from "lodash";
import { type inferRouterContext } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/admin/trpc";

type RouterContext = inferRouterContext<ReturnType<typeof createTRPCRouter>>;

export const restaurantRegionRouter = createTRPCRouter({
  // 列表查询
  listRestaurantRegion: protectedProcedure
    .input(z.object({ name: z.string().optional() }))
    .query(async ({ ctx: { db }, input: { name } }) =>
      db.restaurantRegion.findMany({ where: { name } }),
    ),
});
