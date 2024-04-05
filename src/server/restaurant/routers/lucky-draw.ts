import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/customer/trpc";
import {
  LUCKY_DRAW_NOT_EXISTS_INCORRECT,
  LUCKY_DRAW_NAME_EXISTS_INCORRECT,
  LUCKY_DRAW_ENABLED_EXISTS_INCORRECT,
  LUCKY_DRAW_TOTAL_PROBABILITY_ERROR,
  GIFT_NOT_EXISTS_INCORRECT,
} from "../error";
import { asPageable, asPagedResult } from "~/server/core/schema";
import {
  GiftSchema,
  LuckyDrawSchema,
  LuckyDrawRuleSchema,
} from "prisma/generated/zod";
import { isAfter } from "date-fns";

const PATH_PREFIX = "/lucky-draw";

export const TAG = "2006 - 餐厅 - 抽奖活动";

const toDateTransformer = (value: string) => new Date(value);

const LuckyDrawInputSchema = z
  .object({
    name: z
      .string({ required_error: "restaurant:luckyDrawNameRequired" })
      .max(100, "restaurant:luckyDrawNameMaxLength")
      .describe("抽奖活动名称"),
    en_name: z
      .string({ required_error: "restaurant:luckyDrawEnNameRequired" })
      .max(100, "restaurant:luckyDrawEnNameMaxLength")
      .describe("抽奖活动英文名称"),
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
    description: z
      .string()
      .max(500, "restaurant:luckyDrawDescriptionMaxLength")
      .nullish()
      .describe("抽奖活动描述"),
    en_description: z
      .string()
      .max(500, "restaurant:luckyDrawEnDescriptionMaxLength")
      .nullish()
      .describe("抽奖活动英文描述"),
    isEnabled: z
      .boolean({ required_error: "restaurant:luckyDrawIsEnabledRequired" })
      .describe("是否可用"),
    rules: z.array(
      z
        .object({
          level: z
            .number({ required_error: "restaurant:luckyDrawRuleLevelRequired" })
            .min(0, "restaurant:luckyDrawRuleTitleMinValue")
            .describe("等级标识, 0-未中奖,1-一等奖,2-二等级,以此类推"),
          title: z
            .string({ required_error: "restaurant:luckyDrawRuleTitleRequired" })
            .max(50, "restaurant:luckyDrawRuleTitleMaxLength")
            .describe("标题,对应等级,例如：一等奖 二等奖 三等奖 谢谢参与"),
          en_title: z
            .string({
              required_error: "restaurant:luckyDrawRuleEnTitleRequired",
            })
            .max(50, "restaurant:luckyDrawRuleEnTitleMaxLength")
            .describe(
              "英文标题,对应等级,例如:First Prize Second Prize Third Prize Thank you for participating",
            ),
          giftId: z
            .number({
              required_error: "restaurant:luckyDrawRuleGiftIdRequired",
            })
            .min(0, "restaurant:luckyDrawRuleGiftIdMinValue")
            .describe("礼物Id,level为0时,则为0"),
          totalQuantity: z
            .number({
              required_error: "restaurant:luckyDrawRuleTotalQuantityRequired",
            })
            .min(0, "restaurant:luckyDrawRuleTotalQuantityMinValue")
            .describe("礼物总数量,level为0时,则为0;level不为0时,数量必须大于1"),
          quantity: z
            .number({
              required_error: "restaurant:luckyDrawRuleQuantityRequired",
            })
            .min(0, "restaurant:luckyDrawRuleQuantityMinValue")
            .describe(
              "单次获得礼物数量,level为0时,则为0;level不为0时,数量必须大于1且不能大于总数量",
            ),
          probability: z
            .number({
              required_error: "restaurant:luckyDrawRuleProbabilityRequired",
            })
            .min(0, "restaurant:luckyDrawRuleProbabilityMinValue")
            .max(1, "restaurant:luckyDrawRuleProbabilityMaxValue")
            .describe("概率,0-1之间,例如0.000001")
            .transform((v) => parseFloat(v.toFixed(6))),
        })
        .refine(({ level, totalQuantity, quantity }) => {
          if (level > 0) {
            if (quantity < 1 || totalQuantity < 1 || quantity > totalQuantity) {
              throw "restaurant:luckyDrawRuleTotalQuantityOrQuantityError";
            }
          }
          return true;
        })
        .describe("抽奖规则信息"),
    ),
  })
  .refine((data) => {
    const now = new Date();
    const { startDate, endDate } = data;
    if (startDate && endDate && !isAfter(endDate, startDate)) {
      // 开始时间和结束时间都不为空
      throw "restaurant:luckyDrawEndDateOrStartDateError";
    }
    // if (!isAfter(startDate, now) || !isAfter(endDate, now)) {
    //   throw "restaurant:luckyDrawEndDateOrStartDateError";
    // }
    // else if (startDate && !endDate) {
    //   // 开始时间不为空，结束时间为空
    //   if (!isAfter(startDate, now)) {
    //     throw "restaurant:luckyDrawEndDateOrStartDateError";
    //   }
    // } else if (!startDate && endDate) {
    //   // 开始时间为空，结束时间不为空
    //   if (!isAfter(endDate, now)) {
    //     throw "restaurant:luckyDrawEndDateOrStartDateError";
    //   }
    // }
    return true; // 如果所有条件都满足，则返回 true 表示验证通过);
  });

const LuckyDrawRuleOutputSchema = LuckyDrawRuleSchema.extend({
  gift: GiftSchema.describe("礼物信息").nullish(),
});

const LuckyDrawOutputSchema = LuckyDrawSchema.extend({
  rules: z.array(LuckyDrawRuleOutputSchema).describe("抽奖规则详情").nullish(),
});

export const LuckyDrawRouter = createTRPCRouter({
  createLuckyDraw: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/create`,
        tags: [TAG],
        protect: true,
        summary: "创建抽奖活动及规则",
      },
    })
    .input(LuckyDrawInputSchema)
    .output(z.boolean().describe("是否创建成功,true 成功 false 失败"))
    .mutation(async ({ ctx, input }) => {
      const brandId = ctx.session.brandId;
      const restaurantId = ctx.session.restaurantId;
      const userId = ctx.session.userId;

      const existNameLuckyDraw = await ctx.db.luckyDraw.findFirst({
        where: {
          brandId: brandId,
          restaurantId: restaurantId,
          AND: [
            {
              OR: [{ name: input.name }, { en_name: input.en_name }],
            },
          ],
        },
      });

      if (existNameLuckyDraw) {
        throw LUCKY_DRAW_NAME_EXISTS_INCORRECT();
      }

      if (input.isEnabled) {
        const existEnabledLuckyDraw = await ctx.db.luckyDraw.findFirst({
          where: {
            isEnabled: true,
            brandId: brandId,
            restaurantId: restaurantId,
          },
        });

        if (existEnabledLuckyDraw) {
          throw LUCKY_DRAW_ENABLED_EXISTS_INCORRECT();
        }
      }

      const { rules: newRules, ...data } = input;

      // 计算输入规则的概率总和
      const totalProbability = newRules.reduce(
        (sum, rule) => sum + rule.probability,
        0,
      );

      // 检查是否存在 level 为 0 的规则
      const hasLevelZeroRule = newRules.some((rule) => rule.level === 0);

      // 如果没有 level 为 0 的规则，且总概率小于 1，则添加一条新规则
      if (!hasLevelZeroRule && totalProbability < 1) {
        newRules.push({
          level: 0,
          title: "謝謝參與",
          en_title: "Thank you for participating",
          quantity: 0,
          totalQuantity: 0,
          giftId: 0,
          probability: 1 - totalProbability,
        });
      }

      // 检查新的总概率是否不超过 1
      if (totalProbability > 1) {
        throw LUCKY_DRAW_TOTAL_PROBABILITY_ERROR();
      }

      await ctx.db.$transaction(async (tx) => {
        const luckyDraw = await tx.luckyDraw.create({
          data: {
            ...data,
            restaurantId: restaurantId,
            brandId: brandId,
            createBy: userId,
            updateBy: userId,
          },
        });
        // 如果有抽奖规则需要创建
        if (input.rules?.length) {
          await Promise.all(
            input.rules.map(async (rule) => {
              if (rule.level > 0) {
                const existGift = await tx.gift.findUnique({
                  where: { id: rule.giftId },
                });
                if (!existGift) {
                  throw GIFT_NOT_EXISTS_INCORRECT();
                }
              }
              await tx.luckyDrawRule.create({
                data: {
                  luckyDrawId: luckyDraw.id,
                  residueQuantity: rule.totalQuantity,
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
  getLuckyDrawById: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/get/{id}`,
        tags: [TAG],
        protect: true,
        summary: "根据Id获取餐厅抽奖活动详情及其规则",
      },
    })
    .input(
      z.object({
        id: z
          .number({ required_error: "restaurant:luckyDrawIdRequired" })
          .describe("抽奖活动Id"),
      }),
    )
    .output(LuckyDrawOutputSchema)
    .query(async ({ ctx, input: { id } }) => {
      const existLuckyDraw = await ctx.db.luckyDraw.findUnique({
        where: { id },
      });
      if (!existLuckyDraw) {
        throw LUCKY_DRAW_NOT_EXISTS_INCORRECT();
      }
      const existLuckyDrawRules = await ctx.db.luckyDrawRule.findMany({
        where: { luckyDrawId: id },
      });

      const luckyDrawGiftMap = new Map();
      if (existLuckyDrawRules.length > 0) {
        const luckyDrawGiftIds = existLuckyDrawRules.map((item) => item.giftId);
        const luckyDrawGifts = await ctx.db.gift.findMany({
          where: { id: { in: luckyDrawGiftIds } },
        });
        for (const luckyDrawGift of luckyDrawGifts) {
          luckyDrawGiftMap.set(luckyDrawGift.id, luckyDrawGift) || null;
        }
      }

      return {
        ...existLuckyDraw,
        rules: existLuckyDrawRules?.map((rule) => ({
          ...rule,
          gift: luckyDrawGiftMap.get(rule.giftId),
        })),
      };
    }),
  updateLuckyDrawById: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/update/{id}`,
        tags: [TAG],
        protect: true,
        summary: "根据Id更新餐厅抽奖活动,抽奖规则会清空重建",
      },
    })
    .input(
      z.object({
        id: z
          .number({ required_error: "restaurant:luckyDrawIdRequired" })
          .describe("抽奖活动Id"),
        updateData: LuckyDrawInputSchema,
      }),
    )
    .output(z.boolean().describe("是否更新成功,true 成功 false 失败"))
    .mutation(async ({ ctx, input }) => {
      const restaurantId = ctx.session.restaurantId;
      const brandId = ctx.session.brandId;
      const userId = ctx.session.userId;

      const existLuckyDraw = await ctx.db.luckyDraw.findUnique({
        where: { id: input.id },
      });

      if (!existLuckyDraw) {
        throw LUCKY_DRAW_NOT_EXISTS_INCORRECT();
      }

      const existNameLuckyDraw = await ctx.db.luckyDraw.findFirst({
        where: {
          restaurantId: restaurantId,
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

      if (existNameLuckyDraw) {
        throw LUCKY_DRAW_NAME_EXISTS_INCORRECT();
      }

      if (input.updateData.isEnabled) {
        const existEnabledLuckyDraw = await ctx.db.luckyDraw.findFirst({
          where: {
            isEnabled: true,
            restaurantId: restaurantId,
            brandId: brandId,
            id: { not: input.id },
          },
        });
        if (existEnabledLuckyDraw) {
          throw LUCKY_DRAW_ENABLED_EXISTS_INCORRECT();
        }
      }

      const { rules: newRules, ...data } = input.updateData;

      // 计算输入规则的概率总和
      const totalProbability = newRules.reduce(
        (sum, rule) => sum + rule.probability,
        0,
      );

      // 检查是否存在 level 为 0 的规则
      const hasLevelZeroRule = newRules.some((rule) => rule.level === 0);

      // 如果没有 level 为 0 的规则，且总概率小于 1，则添加一条新规则
      if (!hasLevelZeroRule && totalProbability < 1) {
        newRules.push({
          level: 0,
          title: "謝謝參與",
          en_title: "Thank you for participating",
          quantity: 0,
          totalQuantity: 0,
          giftId: 0,
          probability: 1 - totalProbability,
        });
      }

      // 检查新的总概率是否不超过 1
      if (totalProbability > 1) {
        throw LUCKY_DRAW_TOTAL_PROBABILITY_ERROR();
      }

      await ctx.db.$transaction(async (tx) => {
        // 更新抽奖活动本身
        await tx.luckyDraw.update({
          where: { id: input.id },
          data: {
            ...data,
            brandId: brandId,
            restaurantId: restaurantId,
            updateBy: userId,
          },
        });
        // 清除原有的规则
        if (newRules?.length) {
          await tx.luckyDrawRule.deleteMany({
            where: { luckyDrawId: input.id },
          });

          // 添加或更新新的规则
          await Promise.all(
            newRules.map(async (rule) => {
              if (rule.level > 0) {
                const existGift = await tx.gift.findUnique({
                  where: { id: rule.giftId },
                });
                if (!existGift) {
                  throw GIFT_NOT_EXISTS_INCORRECT();
                }
              }
              await tx.luckyDrawRule.create({
                data: {
                  luckyDrawId: input.id,
                  residueQuantity: rule.totalQuantity,
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
  deleteLuckyDrawById: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/delete/{id}`,
        tags: [TAG],
        protect: true,
        summary: "根据Id删除餐厅抽奖活动及其规则",
      },
    })
    .input(
      z.object({
        id: z
          .number({ required_error: "restaurant:luckyDrawIdRequired" })
          .describe("抽奖活动Id"),
      }),
    )
    .output(z.boolean().describe("是否删除成功,true 成功 false 失败"))
    .mutation(async ({ ctx, input: { id } }) => {
      const existLuckyDraw = await ctx.db.luckyDraw.findUnique({
        where: { id: id },
      });

      if (!existLuckyDraw) {
        throw LUCKY_DRAW_NOT_EXISTS_INCORRECT();
      }

      await ctx.db.$transaction([
        ctx.db.luckyDraw.deleteMany({ where: { id } }),
        ctx.db.luckyDrawRule.deleteMany({
          where: { luckyDrawId: id },
        }),
      ]);

      return true;
    }),
  listLuckyDraw: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/list`,
        tags: [TAG],
        protect: true,
        summary: "获取当前登陆餐厅品牌抽奖活动列表",
      },
    })
    .input(
      z.object({
        name: z.string().optional().describe("抽奖活动名称"),
        enName: z.string().optional().describe("抽奖活动英文名称"),
      }),
    )
    .output(z.array(LuckyDrawOutputSchema))
    .query(async ({ ctx, input }) => {
      const restaurantId = ctx.session.restaurantId;
      const brandId = ctx.session.brandId;

      const luckyDraws = await ctx.db.luckyDraw.findMany({
        where: {
          brandId: brandId,
          restaurantId: restaurantId,
          name: { contains: input.name },
          en_name: { contains: input.enName },
        },
      });

      const luckyDrawRulesMap = new Map();
      if (luckyDraws?.length) {
        for (const luckyDraw of luckyDraws) {
          const luckyDrawRules = await ctx.db.luckyDrawRule.findMany({
            where: { luckyDrawId: luckyDraw.id },
          });

          const luckyDrawGiftMap = new Map();
          if (luckyDrawRules.length > 0) {
            const luckyDrawGiftIds = luckyDrawRules.map((item) => item.giftId);
            const luckyDrawGifts = await ctx.db.gift.findMany({
              where: { id: { in: luckyDrawGiftIds } },
            });
            for (const luckyDrawGift of luckyDrawGifts) {
              luckyDrawGiftMap.set(luckyDrawGift.id, luckyDrawGift);
            }
          }

          luckyDrawRulesMap.set(
            luckyDraw.id,
            luckyDrawRules?.map((luckyDrawRule) => ({
              ...luckyDrawRule,
              gift: luckyDrawGiftMap.get(luckyDrawRule.giftId) || null,
            })),
          );
        }
      }
      return luckyDraws?.map((luckyDraw) => ({
        ...luckyDraw,
        rules: luckyDrawRulesMap.get(luckyDraw.id),
      }));
    }),
  pageLuckyDraw: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/page`,
        tags: [TAG],
        protect: true,
        summary: "获取当前登陆餐厅品牌抽奖活动分页列表",
      },
    })
    .input(
      asPageable(
        z.object({
          name: z.string().optional().describe("抽奖活动名称"),
          enName: z.string().optional().describe("抽奖活动英文名称"),
        }),
      ),
    )
    .output(asPagedResult(LuckyDrawOutputSchema))
    .query(async ({ ctx, input: { page, pageSize, name, enName } }) => {
      const restaurantId = ctx.session.restaurantId;
      const brandId = ctx.session.brandId;

      const where = {
        brandId: brandId,
        restaurantId: restaurantId,
        name: { contains: name },
        en_name: { contains: enName },
      };

      const totalCount = await ctx.db.luckyDraw.count({ where });
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

      const records = await ctx.db.luckyDraw.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        where,
        orderBy: {
          createAt: "desc",
        },
      });

      const luckyDrawRulesMap = new Map();
      if (records?.length) {
        for (const luckyDraw of records) {
          const luckyDrawRules = await ctx.db.luckyDrawRule.findMany({
            where: { luckyDrawId: luckyDraw.id },
          });

          const luckyDrawGiftMap = new Map();
          if (luckyDrawRules.length > 0) {
            const luckyDrawGiftIds = luckyDrawRules.map((item) => item.giftId);
            const luckyDrawGifts = await ctx.db.gift.findMany({
              where: { id: { in: luckyDrawGiftIds } },
            });
            for (const luckyDrawGift of luckyDrawGifts) {
              luckyDrawGiftMap.set(luckyDrawGift.id, luckyDrawGift);
            }
          }

          luckyDrawRulesMap.set(
            luckyDraw.id,
            luckyDrawRules?.map((luckyDrawRule) => ({
              ...luckyDrawRule,
              gift: luckyDrawGiftMap.get(luckyDrawRule.giftId) || null,
            })),
          );
        }
      }
      return {
        page,
        pageSize,
        pageCount,
        totalCount,
        record: records?.map((luckyDraw) => ({
          ...luckyDraw,
          rules: luckyDrawRulesMap.get(luckyDraw.id),
        })),
      };
    }),
  updateLuckyDrawStatus: protectedProcedure
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
        id: z.number().describe("抽奖活动ID"),
        isEnabled: z.boolean().describe("是否启用"),
      }),
    )
    .output(z.boolean().describe("是否删除成功"))
    .mutation(async ({ input: { id, isEnabled }, ctx }) => {
      const restaurantId = ctx.session.restaurantId;

      const existLuckyDraw = await ctx.db.luckyDraw.findUnique({
        where: { id: id },
      });

      if (!existLuckyDraw) {
        throw LUCKY_DRAW_NOT_EXISTS_INCORRECT();
      }

      if (isEnabled) {
        await ctx.db.luckyDraw.updateMany({
          where: { restaurantId: restaurantId },
          data: { isEnabled: false },
        });
      }
      await ctx.db.luckyDraw.update({
        where: { id: id },
        data: { isEnabled },
      });
      return true;
    }),
});
