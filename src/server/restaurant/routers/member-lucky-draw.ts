import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/customer/trpc";
import { asPageable, asPagedResult } from "~/server/core/schema";
import { MemberSchema, MemberLuckyDrawSchema } from "prisma/generated/zod";

export const TAG = "2007 - 餐厅 - 餐厅抽奖记录";

const PATH_PREFIX = "/member-lucky-draw";

const MemberLuckyDrawOutputSchema = MemberLuckyDrawSchema.extend({
  member: MemberSchema.describe("会员信息").nullish(),
});

export const MemberLuckyDrawRouter = createTRPCRouter({
  pageMemberLuchyDraw: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/page`,
        tags: [TAG],
        protect: true,
        summary: "获取会员抽奖记录分页",
      },
    })
    .input(
      asPageable(
        z.object({
          luckyDrawId: z.number().optional().describe("抽奖活动ID"),
          luckyDrawName: z.string().optional().describe("抽奖活动名称"),
          luckyDrawEnName: z.string().optional().describe("抽奖活动英文名称"),
          memberPhone: z.string().optional().describe("会员手机号"),
          memberAccount: z.string().optional().describe("会员账号"),
        }),
      ),
    )
    .output(asPagedResult(MemberLuckyDrawOutputSchema))
    .query(
      async ({
        ctx,
        input: {
          page,
          pageSize,
          luckyDrawName,
          luckyDrawEnName,
          memberPhone,
          memberAccount,
          luckyDrawId,
        },
      }) => {
        const restaurantId = ctx.session.restaurantId;

        const members = await ctx.db.member.findMany({
          where: {
            phone: { contains: memberPhone },
            account: { contains: memberAccount },
          },
        });

        const memberIds = members.map((item) => item.id);

        const where = {
          restaurantId: restaurantId,
          luckyDrawId: luckyDrawId,
          luckyDrawName: { contains: luckyDrawName },
          luckyDrawEn_name: { contains: luckyDrawEnName },
          memberId: { in: memberIds },
        };

        const totalCount = await ctx.db.memberLuckyDraw.count({
          where,
        });
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

        const records = await ctx.db.memberLuckyDraw.findMany({
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
          record: records.map((memberLuckyDraw) => ({
            ...memberLuckyDraw,
            member: memberMap.get(memberLuckyDraw.memberId),
          })),
        };
      },
    ),
});
