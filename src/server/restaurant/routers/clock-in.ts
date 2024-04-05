import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/customer/trpc";
import {
  CLOCK_IN_NOT_EXISTS_INCORRECT,
  CLOCK_IN_NAME_EXISTS_INCORRECT,
  CLOCK_IN_ENABLED_EXISTS_INCORRECT,
  GIFT_NOT_EXISTS_INCORRECT,
} from "../error";
import { asPageable, asPagedResult } from "~/server/core/schema";
import {
  GiftSchema,
  ClockInSchema,
  ClockInRuleSchema,
} from "prisma/generated/zod";
import { isAfter } from "date-fns";

const PATH_PREFIX = "/clock-in";

export const TAG = "2005 - 餐厅 - 打卡活动";

const toDateTransformer = (value: string) => new Date(value);

const ClockInInputSchema = z
  .object({
    name: z
      .string({ required_error: "restaurant:clockInNameRequired" })
      .max(100, "restaurant:clockInNameMaxLength")
      .describe("打卡活动名称"),
    en_name: z
      .string({ required_error: "restaurant:clockInEnNameRequired" })
      .max(100, "restaurant:clockInEnNameMaxLength")
      .describe("打卡活动英文名称"),
    startDate: z
      .string()
      .transform(toDateTransformer)
      .describe("开始时间，不填立刻开始")
      .nullish(),
    endDate: z
      .string()
      .transform(toDateTransformer)
      .describe("结束时间，不填不会结束")
      .nullish(),
    cycleDaysLength: z
      .number({ required_error: "restaurant:clockInCycleDaysLengthRequired" })
      .min(1, "restaurant:clockInCycleDaysLengthMinValue")
      .describe("单次周期天数长度"),
    isLoop: z
      .boolean({ required_error: "restaurant:clockInIsLoopRequired" })
      .describe("是否循环周期"),
    description: z
      .string()
      .max(500, "restaurant:clockInDescriptionMaxLength")
      .nullish()
      .describe("打卡活动描述"),
    en_description: z
      .string()
      .max(500, "restaurant:clockInEnDescriptionMaxLength")
      .nullish()
      .describe("打卡活动英文描述"),
    isEnabled: z
      .boolean({ required_error: "restaurant:clockInIsEnabledRequired" })
      .describe("是否可用"),
    rules: z
      .array(
        z.object({
          cycleDayNumber: z
            .number({
              required_error: "restaurant:clockInRuleCycleDayNumberRequired",
            })
            .min(1, "restaurant:clockInRuleCycleDayNumberMinValue")
            .describe("周期内中奖的天数"),
          title: z
            .string()
            .max(50, "restaurant:clockInRuleTitleMaxLength")
            .describe("描述标题"),
          en_title: z
            .string()
            .max(50, "restaurant:clockInRuleEnTitleMaxLength")
            .describe("描述英文标题"),
          giftId: z
            .number({ required_error: "restaurant:clockInRuleGiftIdRequired" })
            .min(0, "restaurant:clockInRuleGiftIdMinValue")
            .describe("礼物Id,没有礼物则为0"),
          quantity: z
            .number({
              required_error: "restaurant:clockInRuleQuantityRequired",
            })
            .min(1, "restaurant:clockInRuleQuantityMinValue")
            .describe("单次获得数量"),
        }),
      )
      .describe("打卡规则信息"),
  })
  .refine((data) => {
    const now = new Date();
    const { startDate, endDate } = data;
    if (startDate && endDate && !isAfter(endDate, startDate)) {
      // 开始时间和结束时间都不为空
      throw "restaurant:clockInRuleEndDateOrStartDateError";
    }
    return true; // 如果所有条件都满足，则返回 true 表示验证通过);
  });

const ClockInRuleOutputSchema = ClockInRuleSchema.extend({
  gift: GiftSchema.describe("礼物信息").nullish(),
});

const ClockInOutputSchema = ClockInSchema.extend({
  rules: z.array(ClockInRuleOutputSchema).describe("打卡规则详情").nullish(),
});

export const ClockInRouter = createTRPCRouter({
  createClockIn: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/create`,
        tags: [TAG],
        protect: true,
        summary: "创建打卡活动及规则",
      },
    })
    .input(ClockInInputSchema)
    .output(z.boolean().describe("是否创建成功,true 成功 false 失败"))
    .mutation(async ({ ctx, input }) => {
      const brandId = ctx.session.brandId;
      const userId = ctx.session.userId;

      const existNameClockIn = await ctx.db.clockIn.findFirst({
        where: {
          brandId: brandId,
          AND: [
            {
              OR: [{ name: input.name }, { en_name: input.en_name }],
            },
          ],
        },
      });

      if (existNameClockIn) {
        throw CLOCK_IN_NAME_EXISTS_INCORRECT();
      }

      if (input.isEnabled) {
        const existEnabledClockIn = await ctx.db.clockIn.findFirst({
          where: {
            isEnabled: true,
            brandId: brandId,
          },
        });

        if (existEnabledClockIn) {
          throw CLOCK_IN_ENABLED_EXISTS_INCORRECT();
        }
      }

      const { rules: newRules, ...data } = input;

      await ctx.db.$transaction(async (tx) => {
        const clockIn = await tx.clockIn.create({
          data: {
            ...data,
            brandId: brandId,
            createBy: userId,
            updateBy: userId,
          },
        });
        // 如果有打卡规则需要创建;
        if (input.rules?.length) {
          await Promise.all(
            input.rules.map(async (rule) => {
              const existGift = await tx.gift.findUnique({
                where: { id: rule.giftId },
              });
              if (!existGift) {
                throw GIFT_NOT_EXISTS_INCORRECT();
              }
              await tx.clockInRule.create({
                data: {
                  clockInId: clockIn.id,
                  ...rule,
                  createBy: userId,
                  updateBy: userId,
                },
              });
            }),
          );
        }
      });
      return true;
    }),
  getClockInById: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/get/{id}`,
        tags: [TAG],
        protect: true,
        summary: "根据Id获取餐厅打卡活动详情及其规则",
      },
    })
    .input(
      z.object({
        id: z
          .number({ required_error: "restaurant:clockInIdRequired" })
          .describe("打卡活动Id"),
      }),
    )
    .output(ClockInOutputSchema)
    .query(async ({ ctx, input: { id } }) => {
      const existClockIn = await ctx.db.clockIn.findUnique({
        where: { id },
      });
      if (!existClockIn) {
        throw CLOCK_IN_NOT_EXISTS_INCORRECT();
      }
      const existClockInRules = await ctx.db.clockInRule.findMany({
        where: { clockInId: id },
      });

      const clockInGiftMap = new Map();
      if (existClockInRules.length > 0) {
        const clockInGiftIds = existClockInRules.map((item) => item.giftId);
        const clockInGifts = await ctx.db.gift.findMany({
          where: { id: { in: clockInGiftIds } },
        });
        for (const clockInGift of clockInGifts) {
          clockInGiftMap.set(clockInGift.id, clockInGift) || null;
        }
      }

      return {
        ...existClockIn,
        rules: existClockInRules?.map((rule) => ({
          ...rule,
          gift: clockInGiftMap.get(rule.giftId),
        })),
      };
    }),
  updateClockInById: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/update/{id}`,
        tags: [TAG],
        protect: true,
        summary: "根据Id更新餐厅打卡活动及其规则",
      },
    })
    .input(
      z.object({
        id: z
          .number({ required_error: "restaurant:clockInIdRequired" })
          .describe("打卡活动Id"),
        updateData: ClockInInputSchema,
      }),
    )
    .output(z.boolean().describe("是否更新成功,true 成功 false 失败"))
    .mutation(async ({ ctx, input }) => {
      const brandId = ctx.session.brandId;
      const userId = ctx.session.userId;

      const existClockIn = await ctx.db.clockIn.findUnique({
        where: { id: input.id },
      });

      if (!existClockIn) {
        throw CLOCK_IN_NOT_EXISTS_INCORRECT();
      }

      const existNameClockIn = await ctx.db.clockIn.findFirst({
        where: {
          brandId: brandId,
          AND: [
            {
              OR: [
                { name: input.updateData.name },
                { en_name: input.updateData.en_name },
              ],
            },
            {
              id: { not: input.id },
            },
          ],
        },
      });

      if (existNameClockIn) {
        throw CLOCK_IN_NAME_EXISTS_INCORRECT();
      }

      if (input.updateData.isEnabled) {
        const existEnabledClockIn = await ctx.db.clockIn.findFirst({
          where: {
            isEnabled: true,
            brandId: brandId,
            id: { not: input.id },
          },
        });
        if (existEnabledClockIn) {
          throw CLOCK_IN_ENABLED_EXISTS_INCORRECT();
        }
      }

      const { rules: newRules, ...data } = input.updateData;

      await ctx.db.$transaction(async (tx) => {
        // 更新打卡活动本身
        await tx.clockIn.update({
          where: { id: input.id },
          data: {
            ...data,
            brandId: brandId,
            updateBy: userId,
          },
        });
        // 清除原有的规则
        if (input.updateData.rules?.length) {
          await tx.clockInRule.deleteMany({
            where: { clockInId: input.id },
          });

          // 添加或更新新的规则
          await Promise.all(
            input.updateData.rules.map(async (rule) => {
              const existGift = await tx.gift.findUnique({
                where: { id: rule.giftId },
              });
              if (!existGift) {
                throw GIFT_NOT_EXISTS_INCORRECT();
              }
              await tx.clockInRule.create({
                data: {
                  clockInId: input.id,
                  ...rule,
                  updateBy: userId,
                },
              });
            }),
          );
        }
      });
      return true;
    }),
  deleteClockInById: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/delete/{id}`,
        tags: [TAG],
        protect: true,
        summary: "根据Id删除餐厅打卡活动及其规则",
      },
    })
    .input(
      z.object({
        id: z
          .number({ required_error: "restaurant:clockInIdRequired" })
          .describe("打卡活动Id"),
      }),
    )
    .output(z.boolean().describe("是否删除成功,true 成功 false 失败"))
    .mutation(async ({ ctx, input: { id } }) => {
      const existClockIn = await ctx.db.clockIn.findUnique({
        where: { id: id },
      });

      if (!existClockIn) {
        throw CLOCK_IN_NOT_EXISTS_INCORRECT();
      }

      await ctx.db.$transaction([
        ctx.db.clockIn.deleteMany({ where: { id } }),
        ctx.db.clockInRule.deleteMany({
          where: { clockInId: id },
        }),
      ]);

      return true;
    }),
  listClockIn: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/list`,
        tags: [TAG],
        protect: true,
        summary: "获取当前登陆餐厅品牌打卡活动列表",
      },
    })
    .input(
      z.object({
        name: z.string().optional().describe("打卡活动名称"),
        enName: z.string().optional().describe("打卡活动英文名称"),
      }),
    )
    .output(z.array(ClockInOutputSchema))
    .query(async ({ ctx, input }) => {
      const brandId = ctx.session.brandId;

      const clockIns = await ctx.db.clockIn.findMany({
        where: {
          brandId: brandId,
          name: { contains: input.name },
          en_name: { contains: input.enName },
        },
      });

      const clockInRulesMap = new Map();
      if (clockIns?.length) {
        for (const clockIn of clockIns) {
          const clockInRules = await ctx.db.clockInRule.findMany({
            where: { clockInId: clockIn.id },
          });

          const clockInGiftMap = new Map();
          if (clockInRules.length > 0) {
            const clockInGiftIds = clockInRules.map((item) => item.giftId);
            const clockInGifts = await ctx.db.gift.findMany({
              where: { id: { in: clockInGiftIds } },
            });
            for (const clockInGift of clockInGifts) {
              clockInGiftMap.set(clockInGift.id, clockInGift) || null;
            }
          }

          clockInRulesMap.set(
            clockIn.id,
            clockInRules?.map((clockInRule) => ({
              ...clockInRule,
              gift: clockInGiftMap.get(clockInRule.giftId),
            })),
          );
        }
      }
      return clockIns?.map((clockIn) => ({
        ...clockIn,
        rules: clockInRulesMap.get(clockIn.id),
      }));
    }),
  pageClockIn: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/page`,
        tags: [TAG],
        protect: true,
        summary: "获取当前登陆餐厅品牌打卡活动分页列表",
      },
    })
    .input(
      asPageable(
        z.object({
          name: z.string().optional().describe("打卡活动名称"),
          enName: z.string().optional().describe("打卡活动英文名称"),
        }),
      ),
    )
    .output(asPagedResult(ClockInOutputSchema))
    .query(async ({ ctx, input: { page, pageSize, name, enName } }) => {
      const brandId = ctx.session.brandId;

      const where = {
        brandId: brandId,
        name: { contains: name },
        en_name: { contains: enName },
      };

      const totalCount = await ctx.db.clockIn.count({ where });
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

      const records = await ctx.db.clockIn.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        where,
        orderBy: {
          createAt: "desc",
        },
      });

      const clockInRulesMap = new Map();
      if (records?.length) {
        for (const clockIn of records) {
          const clockInRules = await ctx.db.clockInRule.findMany({
            where: { clockInId: clockIn.id },
          });

          const clockInGiftMap = new Map();
          if (clockInRules.length > 0) {
            const clockInGiftIds = clockInRules.map((item) => item.giftId);
            const clockInGifts = await ctx.db.gift.findMany({
              where: { id: { in: clockInGiftIds } },
            });
            for (const clockInGift of clockInGifts) {
              clockInGiftMap.set(clockInGift.id, clockInGift) || null;
            }
          }

          clockInRulesMap.set(
            clockIn.id,
            clockInRules?.map((clockInRule) => ({
              ...clockInRule,
              gift: clockInGiftMap.get(clockInRule.giftId),
            })),
          );
        }
      }
      return {
        page,
        pageSize,
        pageCount,
        totalCount,
        record: records?.map((clockIn) => ({
          ...clockIn,
          rules: clockInRulesMap.get(clockIn.id),
        })),
      };
    }),
  updateClockInStatus: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/status`,
        tags: [TAG],
        protect: true,
        summary: "更新抽奖活动状态",
      },
    })
    .input(
      z.object({
        id: z.number().describe("打卡活动ID"),
        isEnabled: z.boolean().describe("是否启用"),
      }),
    )
    .output(z.boolean().describe("是否更新状态成功,true 成功 false 失败"))
    .mutation(async ({ input: { id, isEnabled }, ctx }) => {
      const brandId = ctx.session.brandId;

      const existClockIn = await ctx.db.clockIn.findUnique({
        where: { id: id },
      });

      if (!existClockIn) {
        throw CLOCK_IN_NOT_EXISTS_INCORRECT();
      }

      if (isEnabled) {
        await ctx.db.clockIn.updateMany({
          where: { brandId: brandId },
          data: { isEnabled: false },
        });
      }

      await ctx.db.clockIn.update({
        where: { id: id },
        data: { isEnabled },
      });

      return true;
    }),
});
