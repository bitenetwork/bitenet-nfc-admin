import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/customer/trpc";
import { asPageable, asPagedResult } from "~/server/core/schema";
import { RestaurantRegionSchema } from "prisma/generated/zod";

const PATH_PREFIX = "/restaurant/region";

export const TAG = "999 - 餐厅 - 餐厅地区";

export const RestaurantRegionRouter = createTRPCRouter({
  listRestaurantRegion: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/list`,
        tags: [TAG],
        protect: true,
        summary: "获取餐厅地区列表",
      },
    })
    .input(
      z.object({
        name: z.string().optional().describe("餐厅地区名称"),
        enName: z.string().optional().describe("餐厅地区英文名称"),
      }),
    )
    .output(z.array(RestaurantRegionSchema))
    .query(async ({ ctx, input }) => {
      const restaurantRegions = await ctx.db.restaurantRegion.findMany({
        where: {
          name: { contains: input.name },
          en_name: { contains: input.enName },
        },
      });
      return restaurantRegions.map((restaurantRegion) => ({
        ...restaurantRegion,
      }));
    }),
  pageRestaurant: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/page`,
        tags: [TAG],
        protect: true,
        summary: "获取餐厅地区分页列表",
      },
    })
    .input(
      asPageable(
        z.object({
          name: z.string().optional().describe("餐厅地区名称"),
          enName: z.string().optional().describe("餐厅地区英文名称"),
        }),
      ),
    )
    .output(asPagedResult(RestaurantRegionSchema))
    .query(async ({ ctx, input: { page, pageSize, name, enName } }) => {
      const where = {
        name: { contains: name },
        en_name: { contains: enName },
      };

      const totalCount = await ctx.db.restaurantRegion.count({ where });
      const pageCount = Math.ceil(totalCount / pageSize);
      if (totalCount === 0) {
        return {
          page,
          pageSize,
          pageCount,
          totalCount,
          record: [],
        };
      }

      const records = await ctx.db.restaurantRegion.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        where,
        orderBy: {
          createAt: "desc",
        },
      });

      return {
        page,
        pageSize,
        pageCount,
        totalCount,
        record: records.map((restaurant) => ({
          ...restaurant,
        })),
      };
    }),
});
