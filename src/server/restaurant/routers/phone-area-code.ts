import { asPageable, asPagedResult } from "~/server/core/schema";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { z } from "zod";
import { PhoneAreaCode } from "@prisma/client";
import { PhoneAreaCodeSchema } from "prisma/generated/zod";

const PATH_PREFIX = "/infra/phone-area-code";

// Swagger 接口标签分组定义
export const TAG = "9999 - 电话区域代码";

export const PhoneAreaCodeRouter = createTRPCRouter({
  pagePhoneAreaCode: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/page-phone-area-code`,
        tags: [TAG],
        summary: "分页获取电话地区代码列表",
      },
    })
    .input(
      asPageable(
        z.object({
          search: z.string().describe("检索词").optional(),
          countryCodes: z
            .string()
            .describe("国家地区代码集合，多个用逗号分割")
            .optional(),
        }),
      ),
    )
    .output(asPagedResult(PhoneAreaCodeSchema))
    .query(async ({ ctx, input: { page, pageSize, search, countryCodes } }) => {
      const where = {
        mix: {
          contains: search,
        },
        countryCode: {
          in: countryCodes?.split(","),
        },
      };

      const totalCount = await ctx.db.phoneAreaCode.count({ where });
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

      const record = await ctx.db.phoneAreaCode.findMany({
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
        record,
      };
    }),

  findPhoneAreaCode: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/find-phone-area-code`,
        tags: [TAG],
        summary: "根据国家地区代码获取电话地区代码",
      },
    })
    .input(
      z.object({
        countryCode: z
          .string({ required_error: "member:findPhoneAreaCode" })
          .describe("地区代码"),
      }),
    )
    .output(PhoneAreaCodeSchema.nullable())
    .query(async ({ ctx, input: { countryCode } }) => {
      return await ctx.db.phoneAreaCode.findFirst({ where: { countryCode } });
    }),
});
