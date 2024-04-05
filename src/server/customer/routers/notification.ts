import { asPageable, asPagedResult } from "~/server/core/schema";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";
import {
  BrandSchema,
  InSiteMessageSchema,
  RestaurantSchema,
  RestaurantUserSchema,
} from "prisma/generated/zod";
import _ from "lodash";
import { Prisma } from "@prisma/client";

const PATH_PREFIX = "/notification";

// Swagger 接口标签分组定义
export const TAG = "2001 - 消息通知";

const PageInSiteMessageOuputsSchemas = InSiteMessageSchema.extend({
  restaurant: RestaurantSchema.optional(),
  brand: BrandSchema.optional(),
});
type PageInSiteMessageOuputs = z.infer<typeof PageInSiteMessageOuputsSchemas>;

export const notificationRouter = createTRPCRouter({
  pageInSiteMessage: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/page-in-site-message`,
        tags: [TAG],
        protect: true,
        summary: "分页获取当前用户站内信列表",
      },
    })
    .input(
      asPageable(
        z.object({
          search: z.string().describe("关搜索键词").optional(),
          status: z.number().describe("状态值：0 未读；1已读").optional(),
          subject: z.string().describe("站内信主题枚举").optional(),
        }),
      ),
    )
    .output(asPagedResult(PageInSiteMessageOuputsSchemas))
    .query(
      async ({ ctx, input: { page, pageSize, search, status, subject } }) => {
        const toMemberId = ctx.session.userId;
        const where = {
          AND: [
            { toMemberId, status, subject },
            {
              OR: [
                {
                  title: {
                    contains: search,
                  },
                },
                {
                  context: {
                    contains: search,
                  },
                },
              ],
            },
          ],
        };

        const totalCount = await ctx.db.inSiteMessage.count({ where });
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

        const record: PageInSiteMessageOuputs[] =
          await ctx.db.inSiteMessage.findMany({
            skip: (page - 1) * pageSize,
            take: pageSize,
            where,
            orderBy: { createAt: "desc" },
          });

        const restaurantIdSet = _.uniq(record.map((x) => x.restaurantId));
        const restaurantList = await ctx.db.restaurant.findMany({
          where: { id: { in: restaurantIdSet } },
        });
        const restaurantMap = Object.fromEntries(
          restaurantList.map((x) => [x.id, x]),
        );

        const brandIdSet = _.uniq(restaurantList.map((x) => x.brandId));
        const brandList = await ctx.db.brand.findMany({
          where: { id: { in: brandIdSet } },
        });
        const brandMap = Object.fromEntries(brandList.map((x) => [x.id, x]));

        for (const item of record) {
          item.restaurant = restaurantMap[item.restaurantId];
          if (item.restaurant) {
            item.brand = brandMap[item.restaurant.brandId];
          }
        }

        return {
          page,
          pageSize,
          pageCount,
          totalCount,
          record,
        };
      },
    ),
  getUnreadCount: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/get-unread-count`,
        tags: [TAG],
        protect: true,
        summary: "获取当前用户未读站内信数量",
      },
    })
    .input(z.void())
    .output(z.object({ unread: z.number().describe("未读消息数量") }))
    .query(async ({ ctx }) => {
      const toMemberId = ctx.session.userId;
      const unread = await ctx.db.inSiteMessage.count({
        where: {
          toMemberId,
          status: 0,
        },
      });
      return { unread };
    }),
  findInSiteMessage: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/find-in-site-message`,
        tags: [TAG],
        protect: true,
        summary: "获取指定站内信详情并更新为已读",
      },
    })
    .input(z.object({ id: z.number() }))
    .output(InSiteMessageSchema.nullable())
    .query(async ({ ctx, input: { id } }) => {
      const inSiteMessage = await ctx.db.inSiteMessage.findUnique({
        where: { id },
      });
      if (ctx.session.userId !== inSiteMessage?.toMemberId) {
        return null;
      }
      await ctx.db.inSiteMessage.update({
        data: {
          status: 1,
        },
        where: {
          id,
        },
      });
      return inSiteMessage;
    }),
  updateAllInSiteMessageRead: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/update-all-in-site-message-read`,
        tags: [TAG],
        protect: true,
        summary: "获取指定站内信详情并更新为已读",
      },
    })
    .input(z.void())
    .output(z.void())
    .mutation(async ({ ctx }) => {
      const toMemberId = ctx.session.userId;
      const unreadCount = await ctx.db.inSiteMessage.count({
        where: {
          toMemberId,
          status: 0,
        },
      });
      if (unreadCount === 0) {
        return;
      }

      await ctx.db.inSiteMessage.updateMany({
        data: { status: 1 },
        where: {
          status: 0,
          toMemberId,
        },
      });
    }),
});
