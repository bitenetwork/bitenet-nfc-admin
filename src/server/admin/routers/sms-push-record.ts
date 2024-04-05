import { AppRouterContext, asPageable } from "~/server/core/schema";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";
import _ from "lodash";

const SmsPushRecordPageInputsSchema = asPageable(
  z.object({
    brandId: z.number().optional(),
    restaurantId: z.number().optional(),
    phoneAreaCode: z.string().optional(),
    phone: z.string().optional(),
    context: z.string().optional(),
  }),
);
type SmsPushRecordPageInputs = z.infer<typeof SmsPushRecordPageInputsSchema>;

const onPageSmsPushRecord = async ({
  ctx,
  input: {
    page,
    pageSize,
    brandId,
    restaurantId,
    phoneAreaCode,
    phone,
    context,
  },
}: {
  ctx: AppRouterContext;
  input: SmsPushRecordPageInputs;
}) => {
  const where = {
    brandId,
    restaurantId,
    phoneAreaCode: {
      contains: phoneAreaCode,
    },
    phone: {
      contains: phone,
    },
    context: {
      contains: context,
    },
  };
  const totalCount = await ctx.db.smsPushRecord.count({ where });
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
  const smsPushRecordList = await ctx.db.smsPushRecord.findMany({
    skip: (page - 1) * pageSize,
    take: pageSize,
    where,
    orderBy: { createAt: "desc" },
  });

  const brandIdSet = _.uniq(smsPushRecordList.map((x) => x.brandId as number));
  const brandList = await ctx.db.brand.findMany({
    where: { id: { in: brandIdSet } },
  });
  const brandMap = Object.fromEntries(brandList.map((x) => [x.id, x]));

  const restaurantIdSet = _.uniq(
    smsPushRecordList.map((x) => x.restaurantId as number),
  );
  const restaurantList = await ctx.db.restaurant.findMany({
    where: { id: { in: restaurantIdSet } },
  });
  const restaurantMap = Object.fromEntries(
    restaurantList.map((x) => [x.id, x]),
  );

  const memberIdSet = _.uniq(
    smsPushRecordList.map((x) => x.memberId as number),
  );
  const memberList = await ctx.db.member.findMany({
    where: { id: { in: memberIdSet } },
  });
  const memberMap = Object.fromEntries(memberList.map((x) => [x.id, x]));

  const record = [];
  for (const smsPushRecord of smsPushRecordList) {
    record.push({
      smsPushRecord,
      brand: brandMap[smsPushRecord.brandId as number],
      restaurant: restaurantMap[smsPushRecord.restaurantId as number],
      member: memberMap[smsPushRecord.memberId as number],
    });
  }

  return {
    page,
    pageSize,
    pageCount,
    totalCount,
    record,
  };
};

export const SmsPushRecordRouter = createTRPCRouter({
  pageSmsPushRecord: protectedProcedure
    .input(SmsPushRecordPageInputsSchema)
    .query(onPageSmsPushRecord),
});
