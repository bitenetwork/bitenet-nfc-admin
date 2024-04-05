import {
  AppRouterContext,
  asPageable,
  asPagedResult,
} from "~/server/core/schema";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";
import { Prisma, NfcSignInRecord } from "@prisma/client";
import {
  MemberSchema,
  RestaurantMemberRelationSchema,
  RestaurantSchema,
  NfcSignInRecordSchema,
  MemberGiftExchangeSchema,
  BrandSchema,
} from "prisma/generated/zod";
import { RESTAURANT_NOT_EXISTS_INCORRECT } from "../error";
import { UNEXPECT } from "~/server/core/error";
import { CopyObjectOutputFilterSensitiveLog } from "@aws-sdk/client-s3";
import _ from "lodash";

const PATH_PREFIX = "/restaurant-member";

export const TAG = "6000 - 顾客列表";

export const PageMemberInputsSchema = asPageable(
  z.object({
    brandId: z.number().optional().describe("品牌id"),
    restaurantId: z.number().optional().describe("餐厅id"),
    nickname: z.string().describe("昵称").optional(),
    tags: z.string().describe("顾客标签，多个标签用逗号分割").optional(),
  }),
);
type PageMemberInputs = z.infer<typeof PageMemberInputsSchema>;

export const onPageMember = async ({
  ctx,
  input: { page, pageSize, restaurantId, nickname, tags, brandId },
}: {
  ctx: AppRouterContext;
  input: PageMemberInputs;
}) => {
  const tables = Prisma.sql`restaurant_member_relation t
  join member m on m.id = t.memberId
  join restaurant r on r.id = t.restaurantId
  `;

  if (nickname) {
    nickname = `%${nickname}%`;
  }

  const tagList = tags?.split(",") || [];
  console.log(tagList);
  const memberIds = (
    tagList.length == 0
      ? []
      : await ctx.db.restaurantMemberTag.findMany({
          where: {
            restaurantId,
            tag: { in: tagList },
          },
        })
  ).map((x) => x.memberId);

  const condition = Prisma.sql` and t.brandId = ${brandId ?? ctx.session.brandId}
  ${
    restaurantId
      ? Prisma.sql`and t.restaurantId = ${restaurantId}`
      : Prisma.empty
  } 
  ${nickname ? Prisma.sql`and u.like = ${nickname}` : Prisma.empty}
  ${
    memberIds.length > 0
      ? Prisma.sql`and t.memberId in (${Prisma.join(memberIds)})`
      : Prisma.empty
  }
  `;

  const skip = (page - 1) * pageSize;
  const take = pageSize;

  const querySql = Prisma.sql`
  select m.*,
  t.restaurantId,
  t.accessTimes,
  t.accessDate,
  t.tags,
  t.staffName,
  r.name,
  r.en_name,
  r.brandId
  from ${tables}
  where 1=1 ${condition}
  order by t.accessDate desc
  limit ${skip}, ${take}`;

  const countSql = Prisma.sql`
    select count(m.id) as totalCount
    from ${tables}
    where 1=1 ${condition}
  `;

  const totalCount = Number(
    (await ctx.db.$queryRaw<{ totalCount: bigint }[]>(countSql))[0]
      ?.totalCount ?? 0n,
  );
  const pageCount = Math.ceil(totalCount / pageSize);

  const record =
    totalCount > 0 ? await ctx.db.$queryRaw<QueryResult[]>(querySql) : [];

  const giftExchangeCondition = Prisma.sql` and brandId = ${ctx.session.brandId}
  ${
    restaurantId ? Prisma.sql`and restaurantId = ${restaurantId}` : Prisma.empty
  }
  `;
  const giftExchangeQuerySql = Prisma.sql`
  select memberId, count(*) as count from member_gift_exchange
  where 1=1 ${giftExchangeCondition}
  group by memberId`;
  const giftExchangeCount =
    await ctx.db.$queryRaw<{ memberId: bigint; count: bigint }[]>(
      giftExchangeQuerySql,
    );
  const giftExchangeCountMap = _.keyBy(giftExchangeCount, "memberId");

  record.forEach((x) => {
    x.id = Number(x.id);
    x.createBy = Number(x.createBy);
    x.updateBy = Number(x.updateBy);
    x.deleteAt = Number(x.deleteAt);
    x.brandId = Number(x.brandId);
    x.freeze = Boolean(x.freeze);
    x.giftCount = Number(giftExchangeCountMap[x.id]?.count ?? 0n);
  });

  return {
    page,
    pageSize,
    pageCount,
    totalCount,
    record,
  };
};

export const PageRestaurantLatentMemberInputsSchema = asPageable(
  z.object({
    brandId: z.number().optional().describe("品牌id"),
  }),
);
type PageRestaurantLatentMemberInputs = z.infer<
  typeof PageRestaurantLatentMemberInputsSchema
>;

export const onPageRestaurantLatentMember = async ({
  ctx,
  input: { page, pageSize, brandId },
}: {
  ctx: AppRouterContext;
  input: PageRestaurantLatentMemberInputs;
}) => {
  let restaurantId;
  let restaurant;
  if (brandId) {
    restaurant = await ctx.db.restaurant.findFirst({
      where: { brandId, isMainStore: true },
    });
    restaurantId = restaurant?.id;
  } else {
    restaurantId = ctx.session.restaurantId;

    // 获取当前餐厅区域下的所有餐厅
    restaurant = await ctx.db.restaurant.findUnique({
      where: { id: restaurantId },
    });
  }

  if (!restaurant) {
    throw RESTAURANT_NOT_EXISTS_INCORRECT();
  }

  // 获取这些餐厅的所有打卡记录
  const querySql = Prisma.sql`SELECT a1.*
  FROM nfc.nfc_sign_in_record a1
  LEFT JOIN nfc.nfc_sign_in_record a2
  ON (a1.memberId = a2.memberId AND a1.signInTime < a2.signInTime and a2.regionCode = ${restaurant.regionCode} 
    and a2.restaurantId <> ${restaurantId} )
  WHERE a2.signInTime IS NULL AND
        a1.regionCode = ${restaurant.regionCode} and a1.restaurantId <> ${restaurantId};
    `;

  const signInRecords = await ctx.db.$queryRaw<NfcSignInRecord[]>(querySql);

  signInRecords.forEach((record) => {
    record.id = Number(record.id);
    record.createBy = Number(record.createBy);
    record.updateBy = Number(record.updateBy);
    record.deleteAt = Number(record.deleteAt);
    record.brandId = Number(record.brandId);
    record.restaurantId = Number(record.restaurantId);
    record.clockInId = Number(record.clockInId);
    record.memberId = Number(record.memberId);
    record.bonus = Number(record.bonus);
    record.bonusMultiple = Number(record.bonusMultiple);
    record.originBouns = Number(record.originBouns);
  });

  // 分页处理和其他统计信息
  const totalCount = signInRecords.length;
  const pageCount = Math.ceil(totalCount / pageSize);
  const pagedSignIns = signInRecords.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  // 获取所有相关的会员信息
  const memberIds = pagedSignIns.map((record) => record.memberId);
  const members = await ctx.db.member.findMany({
    where: { id: { in: memberIds } },
  });

  // 构建一个成员ID与成员对象的映射关系
  const memberIdToMemberMap = new Map(
    members.map((member) => [member.id, member]),
  );

  // 获取所有相关的会员最后打卡餐厅信息
  const restaurantIds = pagedSignIns.map((record) => record.restaurantId);
  const restaurants = await ctx.db.restaurant.findMany({
    where: { id: { in: restaurantIds } },
  });

  // 构建一个餐厅ID与成员对象的映射关系
  const memberIdToRestaurantMap = new Map(
    restaurants.map((restaurant) => [restaurant.id, restaurant]),
  );

  const memberCuisineTypeGroup = await getMemberCuisineTypeGroup({
    ctx,
    memberIds,
  });

  const memberRegionTypeGroup = await getMemberRegionTypeGroup({
    ctx,
    memberIds,
  });

  return {
    page,
    pageSize,
    pageCount,
    totalCount,
    record: pagedSignIns.map((signIn) => ({
      latentSignIn: signIn,
      member: memberIdToMemberMap.get(signIn.memberId),
      latentRestaurant:
        memberIdToRestaurantMap.get(signIn.restaurantId) || null,
      cuisineType: memberCuisineTypeGroup[signIn.memberId] ?? [],
      region: memberRegionTypeGroup[signIn.memberId] ?? [],
    })),
  };
};

export const RestaurantLatentMemberOutPutScheam = z.object({
  member: MemberSchema.omit({
    lastAccessTime: true,
    memberFlag: true,
    virtualUser: true,
  })
    .describe("会员信息")
    .nullish(),
  latentRestaurant: RestaurantSchema.describe("最后一次打卡的餐厅").nullish(),
  latentSignIn: NfcSignInRecordSchema.describe("最后一次打卡记录"),
  cuisineType: z
    .array(
      z.object({
        cuisineTypeName: z.string().describe("菜系名称").nullish(),
        cuisineTypeNameEn: z.string().describe("菜系名称(英文)").nullish(),
        count: z.number().describe("数量"),
      }),
    )
    .nullish(),
  region: z
    .array(
      z.object({
        regionName: z.string().describe("区域名称").nullish(),
        regionNameEn: z.string().describe("区域名称(英文)").nullish(),
        count: z.number().describe("数量"),
      }),
    )
    .nullish(),
});

const getMemberCuisineTypeGroup = async ({
  ctx,
  memberIds,
}: {
  ctx: AppRouterContext;
  memberIds: number[];
}) => {
  const cuisineTypeCountSql = Prisma.sql`SELECT rmr.memberId, r.cuisineTypeId, sum(rmr.accessTimes) as count 
  FROM nfc.restaurant_member_relation rmr
  left join nfc.restaurant r on r.id = rmr.restaurantId
  where rmr.memberId in (${Prisma.join(memberIds)})
  group by memberId, r.cuisineTypeId `;
  const cuisineTypeCount = await ctx.db.$queryRaw<
    {
      memberId: number;
      cuisineTypeId: number;
      count: number;
    }[]
  >(cuisineTypeCountSql);
  const cuisineTypeGroup = _.groupBy(cuisineTypeCount, "memberId");
  const cuisineTypeList = await ctx.db.cuisineType.findMany({});
  const cuisineTypeMap = Object.fromEntries(
    cuisineTypeList.map((c) => [
      c.id,
      {
        cuisineTypeName: c.cuisineTypeName,
        cuisineTypeNameEn: c.cuisineTypeNameEn,
      },
    ]),
  );
  const memberCuisineTypeCount = memberIds.flatMap(
    (memberId) =>
      cuisineTypeGroup[memberId]?.map((c) => ({
        ...cuisineTypeMap[c.cuisineTypeId],
        count: Number(c.count),
        memberId,
      })) ?? [],
  );
  return _.groupBy(memberCuisineTypeCount, "memberId");
};

const getMemberRegionTypeGroup = async ({
  ctx,
  memberIds,
}: {
  ctx: AppRouterContext;
  memberIds: number[];
}) => {
  const regionCodeCountSql = Prisma.sql`SELECT rmr.memberId, r.regionCode, sum(rmr.accessTimes) as count 
  FROM nfc.restaurant_member_relation rmr
  left join nfc.restaurant r on r.id = rmr.restaurantId
  where rmr.memberId in (${Prisma.join(memberIds)})
  group by memberId, r.regionCode `;
  const regionCodeCount = await ctx.db.$queryRaw<
    {
      memberId: number;
      regionCode: string;
      count: number;
    }[]
  >(regionCodeCountSql);
  const regionCodeGroup = _.groupBy(regionCodeCount, "memberId");
  const regionCodeList = await ctx.db.restaurantRegion.findMany({});
  const regionCodeMap = Object.fromEntries(
    regionCodeList.map((c) => [
      c.code,
      {
        regionName: c.name,
        regionNameEn: c.en_name,
      },
    ]),
  );
  const memberRegionCodeCount = memberIds.flatMap(
    (memberId) =>
      regionCodeGroup[memberId]?.map((c) => ({
        ...regionCodeMap[c.regionCode],
        count: Number(c.count),
        memberId,
      })) ?? [],
  );
  return _.groupBy(memberRegionCodeCount, "memberId");
};

export const QueryResultSchema = MemberSchema.omit({
  lastAccessTime: true,
  memberFlag: true,
  virtualUser: true,
  appSignIn: true,
  freepass: true,
})
  .merge(
    RestaurantMemberRelationSchema.pick({
      restaurantId: true,
      accessTimes: true,
      accessDate: true,
      tags: true,
      staffName: true,
    }),
  )
  .merge(
    RestaurantSchema.pick({
      name: true,
      en_name: true,
      brandId: true,
    }),
  )
  .merge(
    z.object({
      giftCount: z.number().int().describe("会员礼物数量"),
    }),
  );

type QueryResult = z.infer<typeof QueryResultSchema>;

const MemberGiftExchangeOutputSchema = MemberGiftExchangeSchema.extend({
  member: MemberSchema.describe("会员信息").nullish(),
  brand: BrandSchema.describe("品牌信息").nullish(),
  restaurant: RestaurantSchema.describe("餐厅信息").nullish(),
});

export const RestaurantMemberRouter = createTRPCRouter({
  listMemberTag: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/list-member-tag`,
        tags: [TAG],
        protect: true,
        summary: "获取顾客标签列表",
      },
    })
    .input(z.void())
    .output(z.array(z.string()))
    .query(async ({ ctx }) => {
      const resultList = await ctx.db.restaurantMemberTag.findMany({
        distinct: ["tag"],
        where: { brandId: ctx.session.brandId },
      });
      return resultList.map((x) => x.tag);
    }),
  updateMemberTag: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/update-member-tag/{memberId}`,
        tags: [TAG],
        protect: true,
        summary: "更新顾客标签",
      },
    })
    .input(
      z.object({
        memberId: z.number().describe("顾客id"),
        tags: z.array(z.string()).describe("顾客标签"),
      }),
    )
    .output(z.array(z.string()))
    .mutation(async ({ ctx, input: { memberId, tags } }) => {
      const brandId = ctx.session.brandId;
      const restaurantId = ctx.session.restaurantId;
      if (!brandId || !restaurantId) {
        throw UNEXPECT();
      }
      const uniqueTags = [...new Set(tags)];
      const tagsToInsert = uniqueTags.map((tag) => ({
        brandId,
        restaurantId,
        memberId,
        tag,
      }));
      await ctx.db.$transaction(async (tx) => {
        await tx.restaurantMemberTag.deleteMany({
          where: {
            restaurantId,
            memberId,
          },
        });
        await tx.restaurantMemberTag.createMany({ data: tagsToInsert });
        await tx.restaurantMemberRelation.update({
          data: {
            tags: uniqueTags.join(","),
          },
          where: {
            restaurantId_memberId_deleteAt: {
              restaurantId,
              memberId,
              deleteAt: 0,
            },
          },
        });
      });

      const resultList = await ctx.db.restaurantMemberTag.findMany({
        where: { restaurantId, memberId },
      });
      return resultList.map((x) => x.tag);
    }),
  pageMember: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/page-member`,
        tags: [TAG],
        protect: true,
        summary: "分页查询顾客列表",
      },
    })
    .input(PageMemberInputsSchema)
    .output(asPagedResult(QueryResultSchema))
    .query(onPageMember),
  pageRestaurantLatentMember: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/latemt-member/page`,
        tags: [TAG],
        protect: true,
        summary: "获取当前登录餐厅潜在会员",
      },
    })
    .input(PageRestaurantLatentMemberInputsSchema)
    .output(asPagedResult(RestaurantLatentMemberOutPutScheam))
    .query(onPageRestaurantLatentMember),
  pageMemberGiftExchange: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/page-member-gift-exchange`,
        tags: [TAG],
        protect: true,
        summary: "获取指定会员礼物兑换记录分页列表",
      },
    })
    .input(
      asPageable(
        z.object({
          memberId: z.number().describe("会员Id"),
          restaurantId: z.number().optional().describe("餐厅Id"),
          giftName: z.string().optional().describe("礼物名称"),
          giftEnName: z.string().optional().describe("礼物英文名称"),
        }),
      ),
    )
    .output(asPagedResult(MemberGiftExchangeOutputSchema))
    .query(
      async ({
        ctx,
        input: { page, pageSize, memberId, giftName, giftEnName, restaurantId },
      }) => {
        const where = {
          exchangeGiftName: { contains: giftName },
          exchangeGiftEn_name: { contains: giftEnName },
          restaurantId: restaurantId,
          brandId: ctx.session.brandId,
          memberId,
        };

        const totalCount = await ctx.db.memberGiftExchange.count({ where });
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

        const records = await ctx.db.memberGiftExchange.findMany({
          skip: (page - 1) * pageSize,
          take: pageSize,
          where,
          orderBy: {
            createAt: "desc",
          },
        });

        const existMember = await ctx.db.member.findUnique({
          where: { id: memberId },
        });

        const brandMap = new Map();
        const restaurantMap = new Map();
        if (records.length > 0) {
          const brandIds = records.map((item) => item.brandId);
          const brands = await ctx.db.brand.findMany({
            where: { id: { in: brandIds } },
          });

          for (const brand of brands) {
            brandMap.set(brand.id, brand);
          }

          const restaurantIds = records.map((item) => item.restaurantId);
          const restaurants = await ctx.db.restaurant.findMany({
            where: { id: { in: restaurantIds } },
          });

          for (const restaurant of restaurants) {
            restaurantMap.set(restaurant.id, restaurant);
          }
        }
        return {
          page,
          pageSize,
          pageCount,
          totalCount,
          record: records.map((memberGiftExchange) => ({
            ...memberGiftExchange,
            member: existMember,
            brand: brandMap.get(memberGiftExchange.brandId),
            restaurant: restaurantMap.get(memberGiftExchange.restaurantId),
          })),
        };
      },
    ),
});
