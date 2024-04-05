import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/customer/trpc";

import {
  AppRouterContext,
  asPageable,
  asPagedResult,
} from "~/server/core/schema";
import {
  BrandSchema,
  RestaurantSchema,
  RestaurantNFCSchema,
  RestaurantRegionSchema,
  MemberLevelDefinitionSchema,
} from "prisma/generated/zod";
import _, { max, min } from "lodash";
import { Prisma, RestaurantMemberRelation } from "@prisma/client";

const PATH_PREFIX = "/brand";

export const TAG = "6005 - 会员 - 品牌信息";

const RestaurantOutputSchema = RestaurantSchema.extend({
  region: RestaurantRegionSchema.describe("地区信息").nullish(),
  nft: RestaurantNFCSchema.describe("NFT信息").nullish(),
});

const RestaurantMemberSchema = z.object({
  accessTimes: z.number().describe("签到次数").nullish(),
  firstTimeAccess: z.date().describe("第一次签到时间").nullish(),
  memberLevel: MemberLevelDefinitionSchema.nullish(),
  levelExpire: z.date().describe("等级过期时间").nullish(),
});

const BrandOutputSchema = BrandSchema.extend({
  restaurants: z.array(RestaurantOutputSchema).describe("餐厅信息").nullable(),
  membership: RestaurantMemberSchema.describe("会员信息").nullish(),
}).nullish();

export const brandRouter = createTRPCRouter({
  getBrandById: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/get/{id}`,
        tags: [TAG],
        protect: true,
        summary: "根据Id获取品牌信息（含已打卡的餐厅信息）",
      },
    })
    .input(
      z.object({
        id: z
          .number({ required_error: "member:brandIdRequired" })
          .describe("品牌Id"),
      }),
    )
    .output(BrandOutputSchema)
    .query(async ({ ctx, input: { id } }) => {
      const brand = await ctx.db.brand.findUnique({ where: { id } });

      if (!brand) {
        return null;
      }

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
        where: { brandId: id, id: { in: relationRestaurantIds } },
      });

      const regionMap = new Map();
      const nfcMap = new Map();
      if (restaurants.length > 0) {
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

      const brandMemberMap = await getBrandMember({
        ctx,
        input: {
          memberId,
          brandIds: [id],
          restaurantMemberRelations,
        },
      });

      return {
        ...brand,
        restaurants: restaurants?.map((restaurant) => ({
          ...restaurant,
          region: regionMap.get(restaurant.regionCode),
          nft: nfcMap.get(restaurant.id),
        })),
        membership: brandMemberMap.get(brand.id),
      };
    }),
  listBrand: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/list`,
        tags: [TAG],
        protect: true,
        summary: "获取当前登录用户已打卡的品牌（含已打卡的餐厅信息）列表",
      },
    })
    .input(
      z.object({
        name: z.string().optional().describe("品牌名称"),
        enName: z.string().optional().describe("品牌英文名称"),
      }),
    )
    .output(z.array(BrandOutputSchema))
    .query(async ({ ctx, input }) => {
      const memberId = ctx.session.userId;

      const restaurantMemberRelations =
        await ctx.db.restaurantMemberRelation.findMany({
          where: {
            memberId: memberId,
          },
        });

      const relationBrandIds = restaurantMemberRelations.map(
        (item) => item.brandId,
      );

      const where = {
        id: { in: relationBrandIds },
        name: { contains: input.name },
        en_name: { contains: input.enName },
      };

      const brands = await ctx.db.brand.findMany({ where });

      const restaurntMap = new Map();

      if (brands.length > 0) {
        const relationRestaurantIds = restaurantMemberRelations.map(
          (item) => item.restaurantId,
        );

        for (const brand of brands) {
          const brandId = brand.id;

          const restaurants = await ctx.db.restaurant.findMany({
            where: { brandId: brandId, id: { in: relationRestaurantIds } },
          });

          const regionMap = new Map();
          const nfcMap = new Map();
          if (restaurants.length > 0) {
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

          restaurntMap.set(
            brandId,
            restaurants?.map((restaurant) => ({
              ...restaurant,
              region: regionMap.get(restaurant.regionCode),
              nft: nfcMap.get(restaurant.id),
            })),
          );
        }
      }

      const brandMemberMap = await getBrandMember({
        ctx,
        input: {
          memberId,
          brandIds: relationBrandIds,
          restaurantMemberRelations,
        },
      });

      return brands.map((brand) => ({
        ...brand,
        restaurants: restaurntMap.get(brand.id),
        membership: brandMemberMap.get(brand.id),
      }));
    }),
  pageBrand: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/page`,
        tags: [TAG],
        protect: true,
        summary:
          "获取当前登录用户已打卡的品牌信息（含已打卡的餐厅信息）列表分页",
      },
    })
    .input(
      asPageable(
        z.object({
          name: z.string().optional().describe("品牌名称"),
          enName: z.string().optional().describe("品牌英文名称"),
        }),
      ),
    )
    .output(asPagedResult(BrandOutputSchema))
    .query(async ({ ctx, input: { page, pageSize, name, enName } }) => {
      const memberId = ctx.session.userId;

      const restaurantMemberRelations =
        await ctx.db.restaurantMemberRelation.findMany({
          where: {
            memberId: memberId,
          },
        });

      const relationBrandIds = restaurantMemberRelations.map(
        (item) => item.brandId,
      );

      const where = {
        id: { in: relationBrandIds },
        name: { contains: name },
        en_name: { contains: enName },
      };

      const totalCount = await ctx.db.brand.count({ where });
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

      const records = await ctx.db.brand.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        where,
        orderBy: {
          createAt: "desc",
        },
      });

      const restaurntMap = new Map();

      if (records.length > 0) {
        const relationRestaurantIds = restaurantMemberRelations.map(
          (item) => item.restaurantId,
        );

        for (const brand of records) {
          const brandId = brand.id;

          const restaurants = await ctx.db.restaurant.findMany({
            where: { brandId: brandId, id: { in: relationRestaurantIds } },
          });

          const regionMap = new Map();
          const nfcMap = new Map();
          if (restaurants.length > 0) {
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

          restaurntMap.set(
            brandId,
            restaurants.map((restaurant) => ({
              ...restaurant,
              region: regionMap.get(restaurant.regionCode),
              nft: nfcMap.get(restaurant.id),
            })),
          );
        }
      }

      const brandMemberMap = await getBrandMember({
        ctx,
        input: {
          memberId,
          brandIds: relationBrandIds,
          restaurantMemberRelations,
        },
      });

      return {
        page,
        pageSize,
        pageCount,
        totalCount,
        record: records.map((brand) => ({
          ...brand,
          restaurants: restaurntMap.get(brand.id),
          membership: brandMemberMap.get(brand.id),
        })),
      };
    }),
  pageRecommendedBrand: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/recommended/page`,
        tags: [TAG],
        protect: true,
        summary: "获取推荐品牌（含品牌下所有餐厅信息）列表分页",
      },
    })
    .input(
      asPageable(
        z.object({
          name: z.string().optional().describe("品牌名称"),
          enName: z.string().optional().describe("品牌英文名称"),
        }),
      ),
    )
    .output(asPagedResult(BrandOutputSchema))
    .query(async ({ ctx, input: { page, pageSize, name, enName } }) => {
      const where = {
        name: { contains: name },
        en_name: { contains: enName },
      };

      const totalCount = await ctx.db.brand.count({ where });
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

      const records = await ctx.db.brand.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        where,
        orderBy: { sort: "desc" },
      });

      const restaurntMap = new Map();

      if (records.length > 0) {
        for (const brand of records) {
          const brandId = brand.id;

          const restaurants = await ctx.db.restaurant.findMany({
            where: { brandId: brandId },
          });

          const regionMap = new Map();
          const nfcMap = new Map();
          if (restaurants.length > 0) {
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

          restaurntMap.set(
            brandId,
            restaurants.map((restaurant) => ({
              ...restaurant,
              region: regionMap.get(restaurant.regionCode),
              nft: nfcMap.get(restaurant.id),
            })),
          );
        }
      }
      return {
        page,
        pageSize,
        pageCount,
        totalCount,
        record: records.map((brand) => ({
          ...brand,
          restaurants: restaurntMap.get(brand.id),
        })),
      };
    }),
});

const getBrandMember = async ({
  ctx,
  input: { memberId, brandIds, restaurantMemberRelations },
}: {
  ctx: AppRouterContext;
  input: {
    memberId: number;
    brandIds: number[];
    restaurantMemberRelations: RestaurantMemberRelation[];
  };
}) => {
  const brandMemberMap = new Map();
  if (_.size(brandIds) === 0) {
    return brandMemberMap;
  }

  const restaurantMemberRelationGrouping = _.groupBy(
    restaurantMemberRelations,
    (x) => x.brandId,
  );

  const levelDefinitionList = await ctx.db.memberLevelDefinition.findMany({
    where: {},
  });
  const levelDefinitionMap = Object.fromEntries(
    levelDefinitionList.map((x) => [x.levelCode, x]),
  );

  const memberLevelList = await ctx.db.memberLevel.findMany({
    where: {
      memberId: memberId,
      brandId: {
        in: brandIds,
      },
    },
  });
  const memberLevelMap = Object.fromEntries(
    memberLevelList.map((x) => [x.brandId, x]),
  );
  const brandMemberLevelMap = new Map();
  for (const memberLevel of memberLevelList) {
    if (memberLevel.levelExpire && memberLevel.levelExpire <= new Date()) {
      brandMemberLevelMap.set(
        memberLevel.brandId,
        levelDefinitionMap[memberLevel.backLevelCode],
      );
    } else {
      brandMemberLevelMap.set(
        memberLevel.brandId,
        levelDefinitionMap[memberLevel.levelCode],
      );
    }
  }

  for (const brandId of brandIds) {
    const relations = restaurantMemberRelationGrouping[brandId] ?? [];
    const accessTimes = relations
      .map((x) => x.accessTimes as number)
      .reduce((prev, cur) => cur + prev, 0);

    const firstTimeAccess = _.min(relations.map((x) => x.createAt as Date));

    const memberLevel =
      brandMemberLevelMap.get(brandId) ?? levelDefinitionMap["LV_GENERAL"];

    const memberLevelDetail = memberLevelMap[brandId];
    let levelExpire = undefined;
    if (
      memberLevelDetail &&
      memberLevelDetail.levelExpire &&
      memberLevelDetail.levelExpire > new Date()
    ) {
      levelExpire = memberLevelDetail.levelExpire;
    }

    brandMemberMap.set(brandId, {
      accessTimes,
      firstTimeAccess,
      memberLevel,
      levelExpire,
    });
  }

  return brandMemberMap;
};
