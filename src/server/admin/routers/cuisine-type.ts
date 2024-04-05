import { createTRPCRouter, protectedProcedure } from "~/server/admin/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { asPageable } from "~/server/core/schema";

export const CuisineTypeRouter = createTRPCRouter({
  createCuisineType: protectedProcedure
    .input(
      z.object({
        cuisineTypeName: z.string().describe("菜系名称"),
        cuisineTypeNameEn: z.string().describe("菜系名称（英文）"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.cuisineType.create({
        data: {
          ...input,
        },
      });
    }),
  deleteCuisineType: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const count = await ctx.db.restaurant.count({
        where: {
          cuisineTypeId: input.id,
        },
      });
      if (count > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `CuisineType used by ${count} restaurant, can not delete`,
        });
      }
      return await ctx.db.cuisineType.delete({ where: { id: input.id } });
    }),
  updateCuisineType: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        data: z.object({
          cuisineTypeName: z.string().describe("菜系名称"),
          cuisineTypeNameEn: z.string().describe("菜系名称（英文）"),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.cuisineType.update({
        data: {
          ...input.data,
        },
        where: {
          id: input.id,
        },
      });
    }),
  findCuisineType: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.cuisineType.findUnique({
        where: {
          id: input.id,
        },
      });
    }),
  listCuisineType: protectedProcedure.input(z.void()).query(async ({ ctx }) => {
    return await ctx.db.cuisineType.findMany({
      orderBy: {
        createAt: "desc",
      },
    });
  }),
  pageCuisineType: protectedProcedure
    .input(
      asPageable(
        z.object({
          cuisineTypeName: z.string().describe("菜系名称").optional(),
          cuisineTypeNameEn: z.string().describe("菜系名称（英文）").optional(),
        }),
      ),
    )
    .query(
      async ({
        ctx,
        input: { page, pageSize, cuisineTypeName, cuisineTypeNameEn },
      }) => {
        const where = {
          cuisineTypeName: {
            contains: cuisineTypeName,
          },
          cuisineTypeNameEn: {
            contains: cuisineTypeNameEn,
          },
        };
        const totalCount = await ctx.db.cuisineType.count({ where });
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
        const record = await ctx.db.cuisineType.findMany({
          skip: (page - 1) * pageSize,
          take: pageSize,
          where,
          orderBy: { createAt: "desc" },
        });
        return {
          page,
          pageSize,
          pageCount,
          totalCount,
          record,
        };
      },
    ),
});
