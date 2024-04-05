import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/customer/trpc";
import {
  RESTAURANT_NOT_EXISTS_INCORRECT,
  BRAND_NOT_EXISTS_INCORRECT,
  REGION_NOT_EXISTS_INCORRECT,
} from "../error";
import { asPageable, asPagedResult } from "~/server/core/schema";
import {
  BrandSchema,
  RestaurantSchema,
  RestaurantNFCSchema,
  RestaurantRegionSchema,
} from "prisma/generated/zod";
import { Prisma } from "@prisma/client";

const PATH_PREFIX = "/restaurant/info";

export const TAG = "6006 - 会员 - 餐厅信息";

const RestaurantOutputSchema = RestaurantSchema.extend({
  brand: BrandSchema.describe("品牌信息").nullish(),
  region: RestaurantRegionSchema.describe("地区信息").nullish(),
  nft: RestaurantNFCSchema.describe("NFT信息").nullish(),
});

export const restaurantRouter = createTRPCRouter({
  getRestaurantById: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/get/{id}`,
        tags: [TAG],
        protect: true,
        summary: "根据Id获取餐厅信息",
      },
    })
    .input(
      z.object({
        id: z
          .number({ required_error: "member:restaurantIdRequired" })
          .describe("餐厅Id"),
      }),
    )
    .output(RestaurantOutputSchema)
    .query(async ({ ctx, input: { id } }) => {
      const restaurant = await ctx.db.restaurant.findUnique({ where: { id } });

      if (!restaurant) {
        throw RESTAURANT_NOT_EXISTS_INCORRECT();
      }

      const brand = await ctx.db.brand.findUnique({
        where: { id: restaurant.brandId },
      });

      if (!brand) {
        throw BRAND_NOT_EXISTS_INCORRECT();
      }

      const region = await ctx.db.restaurantRegion.findUnique({
        where: { code: restaurant.regionCode },
      });

      if (!region) {
        throw REGION_NOT_EXISTS_INCORRECT();
      }

      const nft = await ctx.db.restaurantNFC.findFirst({
        where: { restaurantId: restaurant.id },
      });

      return { ...restaurant, brand: brand, region: region, nft: nft };
    }),
  listRestaurant: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/list`,
        tags: [TAG],
        protect: true,
        summary: "获取当前登陆会员已打卡餐厅列表",
      },
    })
    .input(
      z.object({
        brandId: z.number().optional().describe("品牌Id"),
        name: z.string().optional().describe("餐厅名称"),
        enName: z.string().optional().describe("餐厅英文名称"),
      }),
    )
    .output(z.array(RestaurantOutputSchema))
    .query(async ({ ctx, input }) => {
      const memberId = ctx.session.userId;

      const restaurantMemberRelations =
        await ctx.db.restaurantMemberRelation.findMany({
          where: {
            memberId: memberId,
          },
        });

      const relationRestaurantIds = restaurantMemberRelations.map(
        (item) => item.restaurantId,
      );

      const restaurants = await ctx.db.restaurant.findMany({
        where: {
          brandId: input.brandId,
          id: { in: relationRestaurantIds },
          name: { contains: input.name },
          en_name: { contains: input.enName },
        },
      });

      const brandMap = new Map();
      const regionMap = new Map();
      const nfcMap = new Map();
      if (restaurants.length > 0) {
        const brandIds = restaurants.map((item) => item.brandId);
        const brands = await ctx.db.brand.findMany({
          where: { id: { in: brandIds } },
        });

        for (const brand of brands) {
          brandMap.set(brand.id, brand);
        }

        const regionCodes = restaurants.map((item) => item.regionCode);
        const regions = await ctx.db.restaurantRegion.findMany({
          where: { code: { in: regionCodes } },
        });

        for (const region of regions) {
          regionMap.set(region.code, region);
        }

        const restaurantIds = restaurants.map((item) => item.id);
        const nfcs = await ctx.db.restaurantNFC.findMany({
          where: { restaurantId: { in: restaurantIds } },
        });

        for (const nfc of nfcs) {
          nfcMap.set(nfc.restaurantId, nfc);
        }
      }
      return restaurants.map((restaurant) => ({
        ...restaurant,
        brand: brandMap.get(restaurant.brandId),
        region: regionMap.get(restaurant.regionCode),
        nft: nfcMap.get(restaurant.id),
      }));
    }),
  pageRestaurant: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/page`,
        tags: [TAG],
        protect: true,
        summary: "获取当前登陆会员已打卡餐厅列表分页",
      },
    })
    .input(
      asPageable(
        z.object({
          brandId: z.number().optional().describe("品牌Id"),
          name: z.string().optional().describe("餐厅名称"),
          enName: z.string().optional().describe("餐厅英文名称"),
        }),
      ),
    )
    .output(asPagedResult(RestaurantOutputSchema))
    .query(
      async ({ ctx, input: { page, pageSize, name, enName, brandId } }) => {
        const memberId = ctx.session.userId;

        const restaurantMemberRelations =
          await ctx.db.restaurantMemberRelation.findMany({
            where: {
              memberId: memberId,
            },
          });

        const relationRestaurantIds = restaurantMemberRelations.map(
          (item) => item.restaurantId,
        );

        const where = {
          brandId: brandId,
          id: { in: relationRestaurantIds },
          name: { contains: name },
          en_name: { contains: enName },
        };

        const totalCount = await ctx.db.restaurant.count({ where });
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

        const records = await ctx.db.restaurant.findMany({
          skip: (page - 1) * pageSize,
          take: pageSize,
          where,
          orderBy: {
            createAt: "desc",
          },
        });

        const brandMap = new Map();
        const regionMap = new Map();
        const nfcMap = new Map();
        if (records.length > 0) {
          const brandIds = records.map((item) => item.brandId);
          const brands = await ctx.db.brand.findMany({
            where: { id: { in: brandIds } },
          });

          for (const brand of brands) {
            brandMap.set(brand.id, brand);
          }

          const regionCodes = records.map((item) => item.regionCode);
          const regions = await ctx.db.restaurantRegion.findMany({
            where: { code: { in: regionCodes } },
          });

          for (const region of regions) {
            regionMap.set(region.code, region);
          }

          const restaurantIds = records.map((item) => item.id);
          const nfcs = await ctx.db.restaurantNFC.findMany({
            where: { restaurantId: { in: restaurantIds } },
          });

          for (const nfc of nfcs) {
            nfcMap.set(nfc.restaurantId, nfc);
          }
        }
        return {
          page,
          pageSize,
          pageCount,
          totalCount,
          record: records.map((restaurant) => ({
            ...restaurant,
            brand: brandMap.get(restaurant.brandId),
            region: regionMap.get(restaurant.regionCode),
            nft: nfcMap.get(restaurant.id),
          })),
        };
      },
    ),
});
