import {
  ClockIn,
  MemberGiftExchangeType,
  NfcSignInPeriodStatus,
  NfcSignInPeriodType,
  NfcSignInRecord,
  WalletAccountOwner,
  WalletAccountType,
} from "@prisma/client";
import _ from "lodash";
import moment from "moment";
import {
  ClockInRuleSchema,
  ClockInSchema,
  GiftSchema,
  LuckyDrawSchema,
  MemberGiftExchangeSchema,
  MemberLevelDefinitionSchema,
  MemberSchema,
  NfcSignInRecordSchema,
  RestaurantSchema,
} from "prisma/generated/zod";
import { z } from "zod";
import { DATA_NOT_EXIST, UNEXPECT } from "~/server/core/error";
import { AppRouterContext, asPageable } from "~/server/core/schema";
import { addDaysToDate, getRandomInt } from "~/server/core/utils";
import { upScale } from "~/server/service/global-config";
import {
  getCurrentLevel,
  getNextLevel,
  ratentionLevel,
  upLevel,
} from "~/server/service/member-level";
import { updateRestaurantMemberRelation } from "~/server/service/restaurant-member-relation";
import wallet from "~/server/service/wallet";
import { DISTANCE_INCORRECT, SIGN_IN_INTERVEL } from "../../error";
import Decimal from "decimal.js";
import { env } from "~/env.mjs";

export const GetNextClockInGiftInfoInputsSchema = z.object({
  brandId: z.number().describe("品牌id"),
});
type GetNextClockInGiftInfoInputs = z.infer<
  typeof GetNextClockInGiftInfoInputsSchema
>;

export const GetNextClockInGiftInfoOutputsSchema = z.object({
  signInTimes: z.number().describe("打卡活动周期签到卡次数"),
  clockIn: ClockInSchema.describe("打卡活动信息").optional(),
  clockInRule: ClockInRuleSchema.describe("下一个打卡目标").optional(),
  gift: GiftSchema.describe("下一个打卡目标对应礼物").optional(),
  remaining: z.number().optional().describe("还差多少次打卡可以获取礼物"),
});
type GetNextClockInGiftInfoOutputs = z.infer<
  typeof GetNextClockInGiftInfoOutputsSchema
>;

export const onGetNextClockInGiftInfo = async ({
  ctx,
  input: { brandId },
}: {
  ctx: AppRouterContext;
  input: GetNextClockInGiftInfoInputs;
}) => {
  const now = new Date();
  // 获取餐厅下进行中的打卡送礼物活动
  const clockIn = await ctx.db.clockIn.findFirst({
    where: {
      brandId,
      isEnabled: true,
      AND: {
        OR: [
          {
            startDate: {
              lte: now,
            },
            endDate: {
              gte: now,
            },
          },
          {
            startDate: null,
            endDate: null,
          },
        ],
      },
    },
  });
  if (!clockIn) {
    return { signInTimes: 0 };
  }
  const period = await ctx.db.nfcSignInPeriod.findFirst({
    where: {
      periodType: NfcSignInPeriodType.CLOCK_IN,
      relateId: clockIn.id,
      memberId: ctx.session.userId,
      periodStatus: NfcSignInPeriodStatus.RUNNING,
      periodEndAt: {
        gte: now,
      },
    },
    orderBy: {
      createAt: "desc",
    },
  });

  let clockInRule = await ctx.db.clockInRule.findFirst({
    where: {
      clockInId: clockIn.id,
      cycleDayNumber: {
        gt: period?.signInTimes ?? 0,
      },
    },
    orderBy: {
      cycleDayNumber: "asc",
    },
  });

  if (clockIn.isLoop && !clockInRule) {
    clockInRule = await ctx.db.clockInRule.findFirst({
      where: {
        clockInId: clockIn.id,
      },
      orderBy: {
        cycleDayNumber: "asc",
      },
    });
  }

  if (!clockInRule) {
    return {
      signInTimes: period?.signInTimes ?? 0,
      clockIn,
    } as GetNextClockInGiftInfoOutputs;
  }

  const gift = await ctx.db.gift.findUnique({
    where: { id: clockInRule.giftId },
  });

  if (!gift) {
    return {
      signInTimes: period?.signInTimes ?? 0,
      clockIn,
      clockInRule,
    } as GetNextClockInGiftInfoOutputs;
  }

  let remaining = clockInRule.cycleDayNumber - (period?.signInTimes ?? 0);
  if (remaining < 0) {
    remaining =
      clockInRule.cycleDayNumber +
      (clockIn.cycleDaysLength - (period?.signInTimes ?? 0));
  }

  return {
    signInTimes: period?.signInTimes ?? 0,
    clockIn,
    clockInRule,
    gift,
    remaining,
  } as GetNextClockInGiftInfoOutputs;
};

export const SignInQuery = asPageable(
  z.object({
    brandId: z.number().describe("品牌id").optional(),
    restaurantId: z.number().describe("餐厅id").optional(),
    memberId: z.number().describe("会员id").optional(),
    hasGift: z
      .string()
      .optional()
      .describe("是否含有礼物,true 有礼物 false 无礼物"),
  }),
);

export const SignInPageResutlSchema = NfcSignInRecordSchema.merge(
  z.object({
    member: MemberSchema.optional(),
    restaurant: RestaurantSchema.optional(),
    giftList: z.array(MemberGiftExchangeSchema),
  }),
);

type SignInPageResutl = z.infer<typeof SignInPageResutlSchema>;

export const onPageSignIn = async ({
  ctx,
  input: { page, pageSize, brandId, restaurantId, memberId, hasGift },
}: {
  ctx: AppRouterContext;
  input: z.infer<typeof SignInQuery>;
}) => {
  let signInGiftRecordIds;
  if (hasGift !== undefined) {
    const signInGiftList = await ctx.db.memberGiftExchange.findMany({
      where: {
        exchangeType: MemberGiftExchangeType.SIGN_IN_BOUNS,
        memberId: memberId,
        restaurantId: restaurantId,
      },
      orderBy: {
        createAt: "desc",
      },
    });
    signInGiftRecordIds = signInGiftList
      .map((x) => x.signInRecordId)
      .filter((id): id is number => id !== null && id !== undefined);
  }

  const where = {
    brandId,
    restaurantId,
    memberId,
    ...(hasGift !== undefined && {
      id:
        hasGift === "true"
          ? { in: signInGiftRecordIds }
          : { notIn: signInGiftRecordIds },
    }),
  };
  const totalCount = await ctx.db.nfcSignInRecord.count({ where });
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
  const record = await ctx.db.nfcSignInRecord.findMany({
    skip: (page - 1) * pageSize,
    take: pageSize,
    where,
    orderBy: {
      signInTime: "desc",
    },
  });

  const signInRecorIds = _.uniq(record.map((x) => x.id));
  const restaurantIds = _.uniq(record.map((x) => x.restaurantId));
  const memberIds = _.uniq(record.map((x) => x.memberId));

  const giftList = await ctx.db.memberGiftExchange.findMany({
    where: {
      exchangeType: MemberGiftExchangeType.SIGN_IN_BOUNS,
      signInRecordId: {
        in: signInRecorIds,
      },
    },
    orderBy: {
      createAt: "desc",
    },
  });
  const giftGrouping = _.groupBy(giftList, (x) => x.signInRecordId);

  const restaurantList = await ctx.db.restaurant.findMany({
    where: { id: { in: restaurantIds } },
  });
  const restaurantMap = Object.fromEntries(
    restaurantList.map((x) => [x.id, x]),
  );

  const memberList = await ctx.db.member.findMany({
    where: { id: { in: memberIds } },
  });
  const memberMap = Object.fromEntries(memberList.map((x) => [x.id, x]));

  (record as SignInPageResutl[]).forEach((x) => {
    x.member = memberMap[x.memberId];
    x.restaurant = restaurantMap[x.restaurantId];
    x.giftList = giftGrouping[x.id] ?? [];
    x.bonus = upScale(x.bonus, 100);
    x.originBouns = upScale(x.originBouns, 100);
  });

  return {
    page,
    pageSize,
    pageCount,
    totalCount,
    record: record as SignInPageResutl[],
  };
};

export const SignInInputs = z.object({
  code: z.string().describe("NFC code"),
  lng: z.string().nullish().describe("经度"),
  lat: z.string().nullish().describe("纬度"),
  memberId: z.number().optional().describe("会员ID"),
  signInTime: z.date().optional().describe("签到时间"),
});

export const SignInOutputs = z.object({
  signInRecord: NfcSignInRecordSchema,
  nextLevel: MemberLevelDefinitionSchema.nullish(),
  giftList: z.array(MemberGiftExchangeSchema),
  luckyDraw: LuckyDrawSchema.nullish(),
  signTimesToNextLevel: z
    .number()
    .describe("还需要多少签到可升至下一等级")
    .nullish(),
});

export const onSignIn = async ({
  ctx: baseCtx,
  input: { code, lng, lat, ...rest },
}: {
  ctx: AppRouterContext;
  input: z.infer<typeof SignInInputs>;
}) => {
  const [transational, ctx, txc] = baseCtx.decorators.useTransational(baseCtx);
  return await txc.run(async () => {
    const now = new Date();
    const memberId = rest.memberId ?? ctx.session.userId;
    // 检查NFC是否有效
    const restaurant = await ctx.db.restaurant.findUnique({ where: { code } });
    if (!restaurant || !restaurant.lat || !restaurant.lng) {
      throw DATA_NOT_EXIST();
    }

    if (env.CHECK_SIGN_IN_DISTANCE === 1 && lat && lng) {
      var coord1 = { lat: Number(lat), lng: Number(lng) };
      var coord2 = { lat: Number(restaurant.lat), lng: Number(restaurant.lng) };
      var distanceInMeters = calculateDistance(coord1, coord2);
      if (distanceInMeters > 500) {
        throw DISTANCE_INCORRECT({}, Math.floor(distanceInMeters));
      }
      console.log(calculateDistance(coord1, coord2));
      // await googleMapsClient
      //   .distancematrix({
      //     params: {
      //       origins: [{ lat: lat, lng: lng }],
      //       destinations: [
      //         { lat: Number(restaurant.lat), lng: Number(restaurant.lng) },
      //       ],
      //       key: env.GOOGLE_MAPS_API_KEY,
      //     },
      //     timeout: 1000,
      //   })
      //   .then((response) => {
      //     if (
      //       response &&
      //       response.data &&
      //       response.data.rows[0] &&
      //       response.data.rows[0].elements[0] &&
      //       response.data.rows[0].elements[0].distance
      //     ) {
      //       // 检查距离是否大于500米
      //       const distanceInMeters =
      //         response.data.rows[0].elements[0].distance.value;
      //       if (distanceInMeters > 500) {
      //         throw DISTANCE_INCORRECT();
      //       }
      //     } else {
      //       throw DISTANCE_INCORRECT();
      //     }
      //   });
    }
    const globalConfig = await ctx.db.globalConfig.findUnique({
      where: { id: 1 },
    });
    if (!globalConfig) {
      throw UNEXPECT();
    }
    const restaurantMemberRelation =
      await ctx.db.restaurantMemberRelation.findUnique({
        where: {
          restaurantId_memberId_deleteAt: {
            restaurantId: restaurant.id,
            memberId,
            deleteAt: 0,
          },
        },
      });
    if (restaurantMemberRelation && !rest.signInTime) {
      const signInterval = Math.abs(
        moment().diff(moment(restaurantMemberRelation.accessDate), "minutes"),
      );
      if (signInterval < globalConfig.signInterval) {
        const duration = moment.duration(
          globalConfig.signInterval - signInterval,
          "minutes",
        );
        throw SIGN_IN_INTERVEL(
          {},
          duration.days(),
          duration.hours(),
          duration.minutes(),
        );
      }
    }

    // 获取餐厅下进行中的打卡送礼物活动
    const clockIn = await ctx.db.clockIn.findFirst({
      where: {
        brandId: restaurant.brandId,
        isEnabled: true,
        AND: {
          OR: [
            {
              startDate: {
                lte: now,
              },
              endDate: {
                gte: now,
              },
            },
            {
              startDate: null,
              endDate: null,
            },
          ],
        },
      },
    });

    // 生成随机数奖金
    const bonus = await getBonus({ ctx: ctx as AppRouterContext });

    // 获取当前等级对应的奖励倍数
    const currentLevel = await getCurrentLevel({
      ctx: ctx as AppRouterContext,
      input: { brandId: restaurant.brandId, memberId },
    });
    if (!currentLevel) {
      throw UNEXPECT();
    }
    const bonusMultiple = currentLevel.bonusMultiple;

    // 创建打卡记录
    const signInTime = rest.signInTime ?? new Date();
    const signInRecord = await ctx.db.nfcSignInRecord.create({
      data: {
        restaurantNfcCode: code,
        brandId: restaurant.brandId,
        restaurantId: restaurant.id,
        regionCode: restaurant.regionCode,
        clockInId: clockIn?.id,
        memberId,
        bonus: bonus * bonusMultiple,
        signInTime,
        currentLevelCode: currentLevel.levelCode,
        bonusMultiple: currentLevel.bonusMultiple,
        originBouns: bonus,
      },
    });

    // 更新会员与餐厅关系
    await updateRestaurantMemberRelation(ctx as AppRouterContext, {
      brandId: signInRecord.brandId,
      restaurantId: signInRecord.restaurantId,
      memberId: signInRecord.memberId,
      accessDate: signInRecord.signInTime,
    });

    await handleRatentionLevel({ ctx: ctx as AppRouterContext, signInRecord });
    await handleUpLevel({ ctx: ctx as AppRouterContext, signInRecord });
    if (clockIn) {
      await giveGifts({ ctx: ctx as AppRouterContext, signInRecord, clockIn });
    } else {
      ctx.logger.info(
        `不在签到活动时间范围内吗，或签到活动未启用，不记录打卡周期，signInRecord:${signInRecord.id}`,
      );
    }

    // 返回提升的等级，餐厅是否能抽奖，打卡赠送的礼物
    const relation = await ctx.db.nfcSignInPeriodRelation.findFirst({
      where: {
        periodType: NfcSignInPeriodType.UP_LEVEL,
        nfcSignInRecordId: signInRecord.id,
      },
    });
    const period =
      relation &&
      (await ctx.db.nfcSignInPeriod.findUnique({
        where: {
          id: relation.nfcSignInPeriodId,
        },
      }));
    const nextLevel =
      period &&
      period.relateId &&
      (await ctx.db.memberLevelDefinition.findUnique({
        where: { id: period.relateId },
      }));
    const signTimesToNextLevel =
      period && nextLevel && nextLevel.toLevelTimes - period.signInTimes;

    const giftList = await ctx.db.memberGiftExchange.findMany({
      where: {
        exchangeType: MemberGiftExchangeType.SIGN_IN_BOUNS,
        signInRecordId: signInRecord.id,
      },
    });

    const luckyDraw = await ctx.db.luckyDraw.findFirst({
      where: {
        restaurantId: restaurant.id,
        isEnabled: true,
        startDate: {
          lte: now,
        },
        endDate: {
          gte: now,
        },
      },
    });

    const { getWallet, transferIn } = wallet(ctx as AppRouterContext);
    const walletAccount = await getWallet({
      walletType: WalletAccountType.MEMBER_POINTS,
      ownerType: WalletAccountOwner.MEMBER,
      ownerId: memberId,
    });
    await transferIn(
      { account: walletAccount },
      {
        subject: "SIGN_IN_BOUNS",
        amount: signInRecord.bonus,
        remark: "wallet:GetBounsBySignIn",
        remarkEn: null,
        remarkI18n: true,
        voucherType: "SIGN_IN_RECORD",
        voucher: String(signInRecord.id),
      },
    );

    const resturantWalletAccount = await getWallet({
      walletType: WalletAccountType.MEMBER_POINTS,
      ownerType: WalletAccountOwner.RESTAUARNT,
      ownerId: restaurant.brandId,
    });
    const signInRecordBonus = new Decimal(signInRecord.bonus);
    const resturantSignInCommission = new Decimal(
      globalConfig.resturantSignInCommission,
    );
    await transferIn(
      { account: resturantWalletAccount },
      {
        subject: "SIGN_IN_BOUNS",
        amount: Number(
          signInRecordBonus.mul(resturantSignInCommission).div(100).toFixed(0),
        ),
        remark: "wallet:GetBounsBySignIn",
        remarkEn: null,
        remarkI18n: true,
        voucherType: "SIGN_IN_RECORD",
        voucher: String(signInRecord.id),
      },
    );

    signInRecord.bonus = upScale(signInRecord.bonus, walletAccount.rounding);
    signInRecord.originBouns = upScale(
      signInRecord.originBouns,
      walletAccount.rounding,
    );

    return {
      signInRecord,
      nextLevel:
        period?.periodStatus === NfcSignInPeriodStatus.FINISH
          ? nextLevel
          : null,
      giftList,
      luckyDraw,
      signTimesToNextLevel,
    };
  });
};

const getBonus = async ({ ctx }: { ctx: AppRouterContext }) => {
  const globalConfig = await ctx.db.globalConfig.findUnique({
    where: { id: 1 },
  });
  if (!globalConfig) {
    throw UNEXPECT();
  }
  const bonusStart = globalConfig.bonusPointsRangeStart;
  const bonusEnd = globalConfig.bonusPointsRangeEnd;
  const bonus = getRandomInt(bonusStart, bonusEnd);
  return bonus;
};

const handleRatentionLevel = async ({
  ctx,
  signInRecord,
}: {
  ctx: AppRouterContext;
  signInRecord: NfcSignInRecord;
}) => {
  // 获取打卡会员当前等级
  const currentLevel = await getCurrentLevel({
    ctx,
    input: { brandId: signInRecord.brandId, memberId: signInRecord.memberId },
  });
  if (!currentLevel || currentLevel.keepLevelDays === 0) {
    return;
  }

  /**
   * 品牌Id和会员id查找保级签到周期记录，查找状态=RUNNING，过期时间ExpireAt晚于当前时间的记录.
   * 如果查找到保级签到周期记录则更新累计签到数+1，保级成功
   * 如果找不到保级签到周期记录则则表示保级失败，新增签到周期记录，重新开始累计签到次数
   */
  let period = await ctx.db.nfcSignInPeriod.findFirst({
    where: {
      brandId: signInRecord.brandId,
      memberId: signInRecord.memberId,
      periodType: NfcSignInPeriodType.RATENTION_LEVEL,
      periodStatus: NfcSignInPeriodStatus.RUNNING,
      periodExpireAt: {
        gte: signInRecord.signInTime,
      },
    },
    orderBy: {
      createAt: "desc",
    },
  });

  if (period) {
    if (period.signInTimes + 1 >= currentLevel.keepLevelTimes) {
      // 签到次数累计达标，保留等级

      // 获取当前会员等级，更新会员等级过期时间
      await ratentionLevel({
        ctx,
        input: {
          brandId: signInRecord.brandId,
          memberId: signInRecord.memberId,
          ratentionLevelTime: signInRecord.signInTime,
        },
      });

      // 设置签到周期结束
      await ctx.db.nfcSignInPeriod.update({
        data: {
          signInTimes: {
            increment: 1,
          },
          periodEndAt: addDaysToDate(
            signInRecord.signInTime,
            currentLevel.keepLevelDays,
          ),
          periodExpireAt: addDaysToDate(
            signInRecord.signInTime,
            currentLevel.keepLevelDays,
          ),
        },
        where: { id: period.id },
      });
    } else {
      // 累计签到次数+1
      await ctx.db.nfcSignInPeriod.update({
        data: {
          signInTimes: {
            increment: 1,
          },
        },
        where: { id: period.id },
      });
    }
  } else {
    // 找不到保级签到周期记录，创建新签到周期，并记录累计签到次数为1
    period = await ctx.db.nfcSignInPeriod.create({
      data: {
        brandId: signInRecord.brandId,
        restaurantId: signInRecord.restaurantId,
        memberId: signInRecord.memberId,
        periodType: NfcSignInPeriodType.RATENTION_LEVEL,
        relateId: currentLevel.id,
        periodStatus: NfcSignInPeriodStatus.RUNNING,
        periodStartAt: signInRecord.signInTime,
        periodEndAt: addDaysToDate(
          signInRecord.signInTime,
          currentLevel.keepLevelDays,
        ),
        periodExpireAt: addDaysToDate(
          signInRecord.signInTime,
          currentLevel.keepLevelDays,
        ),
        signInTimes: 1,
      },
    });
  }

  // 保级签到周期与签到记录创建关联关系
  await ctx.db.nfcSignInPeriodRelation.upsert({
    create: {
      periodType: period.periodType,
      relateId: period.relateId,
      nfcSignInPeriodId: period.id,
      nfcSignInRecordId: signInRecord.id,
    },
    update: {},
    where: {
      periodType_relateId_nfcSignInPeriodId_nfcSignInRecordId: {
        periodType: period.periodType,
        relateId: period.relateId,
        nfcSignInPeriodId: period.id,
        nfcSignInRecordId: signInRecord.id,
      },
    },
  });
};

const handleUpLevel = async ({
  ctx,
  signInRecord,
}: {
  ctx: AppRouterContext;
  signInRecord: NfcSignInRecord;
}) => {
  // 获取打卡会员当前等级
  const currentLevel = await getCurrentLevel({
    ctx,
    input: { brandId: signInRecord.brandId, memberId: signInRecord.memberId },
  });
  if (!currentLevel) {
    return;
  }

  // 获取打卡会员下一等级
  const nextLevel = await getNextLevel({
    ctx,
    input: { currentLevel },
  });
  if (!nextLevel) {
    return;
  }

  /**
   * 品牌Id和会员id查找升级签到周期记录，查找状态=RUNNING，过期时间晚于当前时间的记录.
   * 查找到升级签到周期记录则签到数+1，升级需要的签到次数累计成功，判断达标则提升会员等级
   * 找不到升级签到周期记录则则表示升级签到次数累失败，重新开始累计签到卡次数
   */
  let period = await ctx.db.nfcSignInPeriod.findFirst({
    where: {
      brandId: signInRecord.brandId,
      memberId: signInRecord.memberId,
      periodType: NfcSignInPeriodType.UP_LEVEL,
      periodStatus: NfcSignInPeriodStatus.RUNNING,
      periodExpireAt: {
        gte: signInRecord.signInTime,
      },
    },
    orderBy: {
      createAt: "desc",
    },
  });

  if (period) {
    if (period.signInTimes + 1 >= nextLevel.toLevelTimes) {
      // 签到次数累计达标，进行升级

      // 获取当前会员等级，提升会员等级
      await upLevel({
        ctx,
        input: {
          brandId: signInRecord.brandId,
          memberId: signInRecord.memberId,
          upLevelTime: signInRecord.signInTime,
        },
      });

      // 设置签到周期结束
      await ctx.db.nfcSignInPeriod.update({
        data: {
          signInTimes: {
            increment: 1,
          },
          periodStatus: NfcSignInPeriodStatus.FINISH,
        },
        where: { id: period.id },
      });
    } else {
      // 累计签到次数+1
      await ctx.db.nfcSignInPeriod.update({
        data: {
          signInTimes: {
            increment: 1,
          },
        },
        where: { id: period.id },
      });
    }
  } else {
    // 找不到升级签到周期记录，创建新签到周期，并记录累计签到次数为1
    period = await ctx.db.nfcSignInPeriod.create({
      data: {
        brandId: signInRecord.brandId,
        restaurantId: signInRecord.restaurantId,
        memberId: signInRecord.memberId,
        periodType: NfcSignInPeriodType.UP_LEVEL,
        relateId: nextLevel.id,
        periodStatus: NfcSignInPeriodStatus.RUNNING,
        periodStartAt: signInRecord.signInTime,
        periodEndAt: addDaysToDate(
          signInRecord.signInTime,
          nextLevel.toLevelDays,
        ),
        periodExpireAt: addDaysToDate(
          signInRecord.signInTime,
          nextLevel.toLevelDays,
        ),
        signInTimes: 1,
      },
    });
  }

  // 升级签到周期与签到记录创建关联关系
  await ctx.db.nfcSignInPeriodRelation.upsert({
    create: {
      periodType: period.periodType,
      relateId: period.relateId,
      nfcSignInPeriodId: period.id,
      nfcSignInRecordId: signInRecord.id,
    },
    update: {},
    where: {
      periodType_relateId_nfcSignInPeriodId_nfcSignInRecordId: {
        periodType: period.periodType,
        relateId: period.relateId,
        nfcSignInPeriodId: period.id,
        nfcSignInRecordId: signInRecord.id,
      },
    },
  });
};

const giveGifts = async ({
  ctx,
  signInRecord,
  clockIn,
}: {
  ctx: AppRouterContext;
  signInRecord: NfcSignInRecord;
  clockIn: ClockIn;
}) => {
  // 判断打卡活动是否有时间限制，是否开启中
  const now = new Date();
  if (clockIn.startDate && clockIn.endDate) {
    if (now < clockIn.startDate || now > clockIn.endDate) {
      ctx.logger.info(
        `不在活动时间范围内，不记录打卡周期，signInRecord:${signInRecord.id}, clockIn:${clockIn.id}`,
      );
      return;
    }
  }
  if (!clockIn.isEnabled) {
    ctx.logger.info(
      `活动未启用，不记录打卡周期，signInRecord:${signInRecord.id}, clockIn:${clockIn.id}`,
    );
    return;
  }

  // 判断是否循环周期的活动，不是的话，有已经完成的打卡周期，则不继续参与
  if (!clockIn.isLoop) {
    const finishPeriod = await ctx.db.nfcSignInPeriod.findFirst({
      where: {
        periodType: NfcSignInPeriodType.CLOCK_IN,
        relateId: clockIn.id,
        memberId: signInRecord.memberId,
        periodStatus: NfcSignInPeriodStatus.FINISH,
      },
      orderBy: {
        createAt: "asc",
      },
    });
    if (finishPeriod) {
      return;
    }
  }

  // 获取打卡活动对应的进行中的打卡周期记录
  let period = await ctx.db.nfcSignInPeriod.findFirst({
    where: {
      periodType: NfcSignInPeriodType.CLOCK_IN,
      relateId: clockIn.id,
      memberId: signInRecord.memberId,
      periodStatus: NfcSignInPeriodStatus.RUNNING,
      periodEndAt: {
        gte: signInRecord.signInTime,
      },
    },
    orderBy: {
      createAt: "desc",
    },
  });
  if (period) {
    // 根据打卡次数查询是否有对应的奖品
    const clockInRule = await ctx.db.clockInRule.findFirst({
      where: {
        clockInId: clockIn.id,
        cycleDayNumber: period.signInTimes + 1,
      },
      orderBy: {
        createAt: "desc",
      },
    });

    if (clockInRule) {
      // 发送礼物
      const gift = await ctx.db.gift.findUnique({
        where: { id: clockInRule.giftId },
      });
      if (gift) {
        await ctx.db.memberGiftExchange.create({
          data: {
            brandId: signInRecord.brandId,
            restaurantId: signInRecord.restaurantId,
            memberId: signInRecord.memberId,
            exchangeCost: 0,
            type: gift.type,
            exchangeGiftId: gift.id,
            exchangeGiftName: gift.name,
            exchangeGiftEn_name: gift.en_name,
            exchangeGiftPrice: gift.price,
            exchangeGiftPhoto: gift.photo,
            exchangeGiftDescription: gift.description,
            exchangeGiftEn_description: gift.en_description,
            signInRecordId: signInRecord.id,
            exchangeType: MemberGiftExchangeType.SIGN_IN_BOUNS,
            quantity: clockInRule.quantity,
          },
        });
      }
    }

    let periodStatus: NfcSignInPeriodStatus = NfcSignInPeriodStatus.RUNNING;
    if (period.signInTimes + 1 >= clockIn.cycleDaysLength) {
      periodStatus = NfcSignInPeriodStatus.FINISH;
    }

    // 累计签到次数+1
    await ctx.db.nfcSignInPeriod.update({
      data: {
        signInTimes: {
          increment: 1,
        },
        periodStatus,
      },
      where: { id: period.id },
    });
  } else {
    // 打卡周期的结束时间为，当前打卡时间加上活动周期
    // 如果活动有结束时间，且打卡时间加上活动周期后超过了活动结束时间，则打卡周期时间为活动结束时间
    let periodEndAt = addDaysToDate(
      signInRecord.signInTime,
      clockIn.cycleDaysLength,
    );
    if (clockIn.endDate && clockIn.endDate < periodEndAt) {
      periodEndAt = clockIn.endDate;
    }

    // 找不到打卡活动签到周期记录，创建新签到周期，并记录累计签到次数为1
    period = await ctx.db.nfcSignInPeriod.create({
      data: {
        brandId: signInRecord.brandId,
        restaurantId: signInRecord.restaurantId,
        memberId: signInRecord.memberId,
        periodType: NfcSignInPeriodType.CLOCK_IN,
        relateId: clockIn.id,
        periodStatus: NfcSignInPeriodStatus.RUNNING,
        periodStartAt: signInRecord.signInTime,
        periodEndAt,
        periodExpireAt: periodEndAt,
        signInTimes: 1,
      },
    });
  }

  // 打卡活动签到周期与签到记录创建关联关系
  await ctx.db.nfcSignInPeriodRelation.upsert({
    create: {
      periodType: period.periodType,
      relateId: period.relateId,
      nfcSignInPeriodId: period.id,
      nfcSignInRecordId: signInRecord.id,
    },
    update: {},
    where: {
      periodType_relateId_nfcSignInPeriodId_nfcSignInRecordId: {
        periodType: period.periodType,
        relateId: period.relateId,
        nfcSignInPeriodId: period.id,
        nfcSignInRecordId: signInRecord.id,
      },
    },
  });
};

// 定义一个函数来计算弧度
function toRadians(degrees: number) {
  return degrees * (Math.PI / 180);
}

// 定义一个函数来计算两个坐标之间的距离
function calculateDistance(
  coord1: { lat: any; lng: any },
  coord2: { lat: any; lng: any },
) {
  var R = 6371e3; // 地球的平均半径，单位：米
  var lat1 = toRadians(coord1.lat);
  var lat2 = toRadians(coord2.lat);
  var deltaLat = toRadians(coord2.lat - coord1.lat);
  var deltaLon = toRadians(coord2.lng - coord1.lng);

  var a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // 返回距离，单位：米
}
