import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/customer/trpc";
import { asPageable, asPagedResult } from "~/server/core/schema";
import { MemberSchema, MemberGiftExchangeSchema } from "prisma/generated/zod";

export const TAG = "2004 - 餐厅 - 会员礼物兑换记录";

const PATH_PREFIX = "/member-gift-exchange";

const MemberGiftExchangeOutputSchema = MemberGiftExchangeSchema.extend({
  member: MemberSchema.describe("会员信息").nullish(),
});

export const MemberGiftExchangeRouter = createTRPCRouter({
  pageMemberGiftExchange: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/page`,
        tags: [TAG],
        protect: true,
        summary: "获取当前登陆餐厅品牌会员礼物兑换记录分页列表",
      },
    })
    .input(
      asPageable(
        z.object({
          giftName: z.string().optional().describe("礼物名称"),
          giftEnName: z.string().optional().describe("礼物英文名称"),
          memberPhone: z.string().optional().describe("会员手机号"),
          memberAccount: z.string().optional().describe("会员账号"),
        }),
      ),
    )
    .output(asPagedResult(MemberGiftExchangeOutputSchema))
    .query(
      async ({
        ctx,
        input: {
          page,
          pageSize,
          giftName,
          giftEnName,
          memberPhone,
          memberAccount,
        },
      }) => {
        const brandId = ctx.session.brandId;

        const members = await ctx.db.member.findMany({
          where: {
            phone: { contains: memberPhone },
            account: { contains: memberAccount },
          },
        });

        const memberIds = members.map((item) => item.id);

        const where = {
          brandId: brandId,
          exchangeGiftName: { contains: giftName },
          exchangeGiftEn_name: { contains: giftEnName },
          memberId: { in: memberIds },
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

        const memberMap = new Map();
        if (records.length > 0) {
          for (const member of members) {
            memberMap.set(member.id, member);
          }
        }
        return {
          page,
          pageSize,
          pageCount,
          totalCount,
          record: records.map((memberGiftExchange) => ({
            ...memberGiftExchange,
            member: memberMap.get(memberGiftExchange.memberId),
          })),
        };
      },
    ),
});
