import { MemberLevel, MemberLevelDefinition } from "@prisma/client";
import { AppRouterContext } from "~/server/core/schema";
import { UNEXPECT } from "../core/error";
import { addDaysToDate } from "../core/utils";

export const getCurrentLevel = async ({
  ctx,
  input: { brandId, memberId },
}: {
  ctx: AppRouterContext;
  input: {
    brandId: number;
    memberId: number;
  };
}) => {
  const memberLevel = await getOrCreateMemberLevel({
    ctx,
    input: { brandId, memberId },
  });

  if (memberLevel.levelExpire && memberLevel.levelExpire <= new Date()) {
    return await ctx.db.memberLevelDefinition.findUnique({
      where: { levelCode: memberLevel.backLevelCode },
    });
  } else {
    return await ctx.db.memberLevelDefinition.findUnique({
      where: { levelCode: memberLevel.levelCode },
    });
  }
};

export const getNextLevel = async ({
  ctx,
  input: { currentLevel },
}: {
  ctx: AppRouterContext;
  input: {
    currentLevel: MemberLevelDefinition;
  };
}) => {
  if (!currentLevel) {
    return null;
  }

  if (!currentLevel.nextLevelCode) {
    return null;
  }

  return await ctx.db.memberLevelDefinition.findUnique({
    where: {
      levelCode: currentLevel.nextLevelCode,
    },
  });
};

export const upLevel = async ({
  ctx,
  input: { brandId, memberId, upLevelTime },
}: {
  ctx: AppRouterContext;
  input: {
    brandId: number;
    memberId: number;
    upLevelTime: Date;
  };
}) => {
  const memberLevel = await getOrCreateMemberLevel({
    ctx,
    input: { brandId, memberId },
  });

  const currentLevel = (await getCurrentLevel({
    ctx,
    input: { brandId, memberId },
  })) as MemberLevelDefinition;

  const nextLevel = await getNextLevel({
    ctx,
    input: { currentLevel },
  });

  if (!nextLevel) {
    return;
  }

  await ctx.db.memberLevel.update({
    data: {
      levelCode: nextLevel.levelCode,
      backLevelCode: nextLevel.backLevelCode,
      levelExpire: addDaysToDate(upLevelTime, nextLevel.keepLevelDays),
    },
    where: {
      brandId_memberId_deleteAt: {
        brandId,
        memberId,
        deleteAt: 0,
      },
    },
  });
};

export const ratentionLevel = async ({
  ctx,
  input: { brandId, memberId, ratentionLevelTime },
}: {
  ctx: AppRouterContext;
  input: {
    brandId: number;
    memberId: number;
    ratentionLevelTime: Date;
  };
}) => {
  const currentLevel = (await getCurrentLevel({
    ctx,
    input: { brandId, memberId },
  })) as MemberLevelDefinition;

  await ctx.db.memberLevel.update({
    data: {
      levelExpire: addDaysToDate(
        ratentionLevelTime,
        currentLevel.keepLevelDays,
      ),
    },
    where: {
      brandId_memberId_deleteAt: {
        brandId,
        memberId,
        deleteAt: 0,
      },
    },
  });
};

const getOrCreateMemberLevel = async ({
  ctx,
  input: { brandId, memberId },
}: {
  ctx: AppRouterContext;
  input: {
    brandId: number;
    memberId: number;
  };
}) => {
  const memberLevel = await ctx.db.memberLevel.findUnique({
    where: {
      brandId_memberId_deleteAt: {
        brandId,
        memberId,
        deleteAt: 0,
      },
    },
  });
  if (memberLevel) {
    return memberLevel;
  }
  return await ctx.db.memberLevel.create({
    data: {
      brandId,
      memberId,
    },
  });
};
