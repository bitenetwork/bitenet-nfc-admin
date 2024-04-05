import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/customer/trpc";
import { asPageable, asPagedResult } from "~/server/core/schema";
import { GiftSchema } from "prisma/generated/zod";

const PATH_PREFIX = "/gift";

export const TAG = "6003 - 会员 - 礼物信息";

export const giftRouter = createTRPCRouter({
  pageGift: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/page`,
        tags: [TAG],
        protect: true,
        summary: "获取餐厅品牌可兑换礼物分页",
      },
    })
    .input(
      asPageable(
        z.object({
          brandId: z.number().optional().describe("品牌Id"),
          exchangeCostLte: z.number().optional().describe("兑换花费小于等于"),
          exchangeCostGte: z.number().optional().describe("兑换花费大于等于"),
          name: z.string().optional().describe("礼物名称"),
          enName: z.string().optional().describe("礼物英文名称"),
        }),
      ),
    )
    .output(asPagedResult(GiftSchema))
    .query(
      async ({
        ctx,
        input: {
          page,
          pageSize,
          exchangeCostLte,
          exchangeCostGte,
          name,
          enName,
          brandId,
        },
      }) => {
        const where = {
          isExchange: true,
          name: { contains: name },
          en_name: { contains: enName },
          exchangeCost: { gte: exchangeCostGte, lte: exchangeCostLte },
          brandId: brandId,
        };

        const totalCount = await ctx.db.gift.count({ where });
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

        const records = await ctx.db.gift.findMany({
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
          record: records?.map((gift) => ({
            ...gift,
          })),
        };
      },
    ),
});
