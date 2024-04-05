import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/customer/trpc";
import {
  RESTAURANT_NOT_EXISTS_INCORRECT,
  BRAND_NOT_EXISTS_INCORRECT,
  REGION_NOT_EXISTS_INCORRECT,
} from "../error";
import { asPageable, asPagedResult } from "~/server/core/schema";
import { Prisma } from "@prisma/client";
import {
  BrandSchema,
  RestaurantSchema,
  RestaurantRegionSchema,
  CuisineTypeSchema,
} from "prisma/generated/zod";

const PATH_PREFIX = "/restaurant/info";

export const TAG = "2001 - 餐厅 - 餐厅信息";

const RestaurantInputSchema = z.object({
  name: z
    .string({ required_error: "restaurant:nameRequired" })
    .max(255, "restaurant:nameMaxLength")
    .describe("餐厅名称"),
  en_name: z
    .string({ required_error: "restaurant:enNameRequired" })
    .max(255, "restaurant:enNameMaxLength")
    .describe("餐厅英文名称"),
  address: z
    .string({ required_error: "restaurant:enAddressRequired" })
    .max(500, "restaurant:enAddressMaxLength")
    .describe("餐厅地址"),
  en_address: z
    .string({ required_error: "restaurant:addressRequired" })
    .max(500, "restaurant:addressMaxLength")
    .describe("餐厅地址"),
  regionCode: z
    .string({ required_error: "restaurant:regionCodeRequired" })
    .max(50, "restaurant:regionCodeMaxLength")
    .describe("餐厅所在区"),
  contacts: z
    .string({ required_error: "restaurant:contactsRequired" })
    .max(50, "restaurant:contactsMaxLength")
    .describe("联系人"),
  contactsWay: z
    .string({ required_error: "restaurant:contactsWayRequired" })
    .max(32, "restaurant:contactsWayMaxLength")
    .describe("联系方式"),
  cover: z
    .string({ required_error: "restaurant:coverRequired" })
    .max(500, "restaurant:coverMaxLength")
    .describe("餐厅封面"),
  lng: z
    .string({ required_error: "restaurant:lngRequired" })
    .max(100, "restaurant:lngMaxLength")
    .describe("经度"),
  lat: z
    .string({ required_error: "restaurant:latRequired" })
    .max(100, "restaurant:latMaxLength")
    .describe("纬度"),
  description: z
    .string()
    .max(500, "restaurant:descriptionMaxLength")
    .nullish()
    .describe("餐厅描述"),
  en_description: z
    .string()
    .max(500, "restaurant:enDescriptionMaxLength")
    .nullish()
    .describe("餐厅英文描述"),
  minimumCharge: z
    .number()
    .min(0, "restaurant:minimumChargeMinValue")
    .nullish()
    .describe("餐厅最低消费"),
  cuisineTypeId: z.number().default(0).describe("菜系id"),
});

const RestaurantOutputSchema = RestaurantSchema.extend({
  brand: BrandSchema.describe("品牌信息详情").nullish(),
  region: RestaurantRegionSchema.describe("地区信息").nullish(),
  cuisineType: CuisineTypeSchema.describe("菜系类型").nullish(),
});

export const RestaurantRouter = createTRPCRouter({
  getRestaurant: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/get-by-login`,
        tags: [TAG],
        protect: true,
        summary: "获取登陆用户餐厅品牌信息",
      },
    })
    .input(z.void())
    .output(RestaurantOutputSchema)
    .query(async ({ ctx }) => {
      const restaurantId = ctx.session.restaurantId;

      const restaurant = await ctx.db.restaurant.findUnique({
        where: { id: restaurantId, deleteAt: 0 },
      });

      if (!restaurant) {
        throw RESTAURANT_NOT_EXISTS_INCORRECT();
      }

      const brand = await ctx.db.brand.findUnique({
        where: { id: restaurant.brandId, deleteAt: 0 },
      });

      if (!brand) {
        throw BRAND_NOT_EXISTS_INCORRECT();
      }

      const region = await ctx.db.restaurantRegion.findUnique({
        where: { code: restaurant.regionCode, deleteAt: 0 },
      });

      if (!region) {
        throw REGION_NOT_EXISTS_INCORRECT();
      }

      const cuisineType = await ctx.db.cuisineType.findUnique({
        where: { id: restaurant.cuisineTypeId },
      });

      return {
        ...restaurant,
        brand: brand,
        region: region,
        cuisineType,
      };
    }),
  getRestaurantById: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/get/{id}`,
        tags: [TAG],
        protect: true,
        summary: "根据Id获取餐厅品牌信息",
      },
    })
    .input(
      z.object({
        id: z
          .number({ required_error: "restaurant:restaurantIdRequired" })
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

      const cuisineType = await ctx.db.cuisineType.findUnique({
        where: { id: restaurant.cuisineTypeId },
      });

      return { ...restaurant, brand: brand, region: region, cuisineType };
    }),
  listRestaurant: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/list`,
        tags: [TAG],
        protect: true,
        summary: "获取当前登陆餐厅品牌餐厅列表",
      },
    })
    .input(
      z.object({
        name: z.string().optional().describe("餐厅名称"),
        enName: z.string().optional().describe("餐厅英文名称"),
      }),
    )
    .output(z.array(RestaurantOutputSchema))
    .query(async ({ ctx, input }) => {
      const brandId = ctx.session.brandId;
      const restaurants = await ctx.db.restaurant.findMany({
        where: {
          brandId: brandId,
          name: { contains: input.name },
          en_name: { contains: input.enName },
        },
      });

      const brandMap = new Map();
      const regionMap = new Map();
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
      }

      const cuisineTypeList = await ctx.db.cuisineType.findMany({});
      const cuisineTypeMap = Object.fromEntries(
        cuisineTypeList.map((x) => [x.id, x]),
      );

      return restaurants.map((restaurant) => ({
        ...restaurant,
        brand: brandMap.get(restaurant.brandId),
        region: regionMap.get(restaurant.regionCode),
        cuisineType: cuisineTypeMap[restaurant.cuisineTypeId],
      }));
    }),
  pageRestaurant: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/page`,
        tags: [TAG],
        protect: true,
        summary: "获取当前登陆餐厅品牌餐厅分页列表",
      },
    })
    .input(
      asPageable(
        z.object({
          name: z.string().optional().describe("餐厅名称"),
          enName: z.string().optional().describe("餐厅英文名称"),
        }),
      ),
    )
    .output(asPagedResult(RestaurantOutputSchema))
    .query(async ({ ctx, input: { page, pageSize, name, enName } }) => {
      const brandId = ctx.session.brandId;

      const where = {
        brandId: brandId,
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
      }

      const cuisineTypeList = await ctx.db.cuisineType.findMany({});
      const cuisineTypeMap = Object.fromEntries(
        cuisineTypeList.map((x) => [x.id, x]),
      );

      return {
        page,
        pageSize,
        pageCount,
        totalCount,
        record: records.map((restaurant) => ({
          ...restaurant,
          brand: brandMap.get(restaurant.brandId),
          region: regionMap.get(restaurant.regionCode),
          cuisineType: cuisineTypeMap[restaurant.cuisineTypeId],
        })),
      };
    }),
  updateRestaurantById: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/update`,
        tags: [TAG],
        protect: true,
        summary: "更新当前登陆餐厅品牌餐厅信息",
      },
    })
    .input(RestaurantInputSchema)
    .output(z.boolean().describe("是否更新成功,true 成功 false 失败"))
    .mutation(async ({ ctx, input }) => {
      const restaurantId = ctx.session.restaurantId;

      const existRestaurant = await ctx.db.restaurant.findUnique({
        where: { id: restaurantId },
      });

      if (!existRestaurant) {
        throw RESTAURANT_NOT_EXISTS_INCORRECT();
      }

      await ctx.db.restaurant.update({
        where: { id: restaurantId },
        data: {
          ...input,
          indexCode: existRestaurant.indexCode,
          code: existRestaurant.code,
          brandId: existRestaurant.brandId,
          isMainStore: existRestaurant.isMainStore,
          updateBy: ctx.session.userId,
        },
      });
      return true;
    }),
});
