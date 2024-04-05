import { createTRPCRouter, protectedProcedure } from "~/server/admin/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { asPageable } from "~/server/core/schema";
import { CuisineTypeSchema } from "prisma/generated/zod";

const PATH_PREFIX = "/restaurant/cuisine-type";

export const TAG = "2001 - 餐厅 - 菜系信息";

export const CuisineTypeRouter = createTRPCRouter({
  findCuisineType: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/find-cuisine-type/{id}`,
        tags: [TAG],
        protect: true,
        summary: "获取菜系详情",
      },
    })
    .input(z.object({ id: z.number() }))
    .output(CuisineTypeSchema.nullish())
    .query(async ({ ctx, input }) => {
      return await ctx.db.cuisineType.findUnique({
        where: {
          id: input.id,
        },
      });
    }),
  listCuisineType: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/list-cuisine-type`,
        tags: [TAG],
        protect: true,
        summary: "获取菜系列表",
      },
    })
    .input(z.void())
    .output(z.array(CuisineTypeSchema))
    .query(async ({ ctx }) => {
      return await ctx.db.cuisineType.findMany({
        orderBy: {
          createAt: "desc",
        },
      });
    }),
});
