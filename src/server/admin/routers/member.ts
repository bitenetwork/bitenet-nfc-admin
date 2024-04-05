import {
  OperatorType,
  RechargeRecordType,
  WalletAccountOwner,
  WalletAccountType,
} from "@prisma/client";
import Decimal from "decimal.js";
import _ from "lodash";
import { MemberSchema } from "prisma/generated/zod";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/admin/trpc";
import {
  AppRouterContext,
  asPageable,
  asPagedResult,
} from "~/server/core/schema";
import {
  SignInInputs,
  SignInOutputs,
  onSignIn,
} from "~/server/customer/routers/nfc-sign-in/handler";
import { upScale } from "~/server/service/global-config";
import wallet from "~/server/service/wallet";

const CreateMemberInputs = z.object({
  phoneAreaCode: z.string().optional(),
  phone: z.string().optional(),
  account: z.string(),
  nickname: z.string(),
});
type CreateMemberInputsSchema = z.infer<typeof CreateMemberInputs>;

const onCreateMember = async ({
  ctx,
  input,
}: {
  ctx: AppRouterContext;
  input: CreateMemberInputsSchema;
}) => {
  return await ctx.db.member.create({
    data: {
      ...input,
    },
  });
};

const UpdateMemberInputs = z.object({
  id: z.number(),
  data: z.object({
    phoneAreaCode: z.string().optional(),
    phone: z.string().optional(),
    nickname: z.string().optional(),
  }),
});
type UpdateMemberInputsSchema = z.infer<typeof UpdateMemberInputs>;

const onUpdateMember = async ({
  ctx,
  input: { id, data },
}: {
  ctx: AppRouterContext;
  input: UpdateMemberInputsSchema;
}) => {
  return await ctx.db.member.update({
    data,
    where: {
      id,
    },
  });
};

const FreezeMemberInputs = z.object({
  freezeReason: z.string().describe("账号冻结原因"),
});
type FreezeMemberInputsSchema = z.infer<typeof FreezeMemberInputs>;

const onFreezeMember = async ({
  ctx,
  input: { id, data },
}: {
  ctx: AppRouterContext;
  input: { id: number; data: FreezeMemberInputsSchema };
}) =>
  await ctx.db.member.update({
    data: { ...data, freeze: true },
    where: { id },
  });

const onUnfreezeMember = async ({
  ctx,
  input: { id },
}: {
  ctx: AppRouterContext;
  input: { id: number };
}) =>
  await ctx.db.member.update({
    data: { freeze: false },
    where: { id },
  });

const onFindMember = async ({
  ctx,
  input: { id },
}: {
  ctx: AppRouterContext;
  input: { id: number };
}) => await ctx.db.member.findUnique({ where: { id } });

const PageMemberInputs = asPageable(
  z.object({
    account: z.string().optional(),
    phoneAreaCode: z.string().optional(),
    phone: z.string().optional(),
    nickname: z.string().optional(),
    memberIds: z.array(z.number()).optional(),
  }),
);
type PageMemberInputsSchema = z.infer<typeof PageMemberInputs>;

const PageMemberOutputs = asPagedResult(
  MemberSchema.extend({
    balance: z.number().optional(),
    lastRestaurant: z
      .object({
        restaurant: z.string(),
        accessDate: z.date().nullish(),
      })
      .optional(),
  }),
);
type PageMemberOutputsSchema = z.infer<typeof PageMemberOutputs>;

const onPageMember = async ({
  ctx,
  input: { page, pageSize, ...input },
}: {
  ctx: AppRouterContext;
  input: PageMemberInputsSchema;
}) => {
  const where = {
    account: { contains: input.account },
    phoneAreaCode: { contains: input.phoneAreaCode },
    phone: { contains: input.phone },
    nickname: { contains: input.nickname },
    id: { in: input.memberIds },
  };
  const totalCount = await ctx.db.member.count({ where });
  const pageCount = Math.ceil(totalCount / pageSize);
  if (totalCount === 0) {
    return {
      page,
      pageSize,
      totalCount,
      pageCount,
      record: [],
    };
  }
  const record = await ctx.db.member.findMany({
    where,
    orderBy: {
      createAt: "desc",
    },
  });

  const walletType = WalletAccountType.MEMBER_POINTS;
  const ownerType = WalletAccountOwner.MEMBER;
  const memberIds = _.uniq(record.map(({ id }) => id));
  const balanceList = await ctx.db.walletBalance.findMany({
    where: {
      walletType,
      ownerType,
      ownerId: {
        in: memberIds,
      },
    },
  });
  const balanceMap = Object.fromEntries(
    balanceList.map((x) => [x.ownerId, upScale(x.balance, 100)]),
  );

  const restaurantMemberRelations =
    await ctx.db.restaurantMemberRelation.findMany({
      where: {
        memberId: {
          in: memberIds,
        },
      },
    });

  const restaurantIdSet = _.uniq(
    restaurantMemberRelations.map((x) => x.restaurantId),
  );
  const restaurantList = await ctx.db.restaurant.findMany({
    where: {
      id: {
        in: restaurantIdSet,
      },
    },
  });
  const restaurantMap = Object.fromEntries(
    restaurantList.map((x) => [x.id, x]),
  );

  const restaurantMemberRelationGroup = _.groupBy(
    restaurantMemberRelations,
    (x) => x.memberId,
  );
  const lastResturantMap: Record<
    string,
    { restaurant: string; accessDate: Date | null }
  > = {};
  for (const key in restaurantMemberRelationGroup) {
    const list = restaurantMemberRelationGroup[key];
    const restaurantMemberRelation = _.maxBy(list, (x) => x.accessDate);
    if (!restaurantMemberRelation) {
      continue;
    }
    lastResturantMap[key] = {
      restaurant:
        restaurantMap[restaurantMemberRelation.restaurantId]?.en_name ?? "",
      accessDate: restaurantMemberRelation.accessDate,
    };
  }

  return {
    page,
    pageSize,
    totalCount,
    pageCount,
    record: record.map((member) => ({
      ...member,
      balance: balanceMap[member.id] ?? 0,
      lastRestaurant: lastResturantMap[member.id],
    })),
  };
};

const AddRechargeInputs = z.object({
  memberId: z.number(),
  amount: z.number(),
  remark: z.string(),
  remarkEn: z.string(),
});
type AddRechargeInputsSchemas = z.infer<typeof AddRechargeInputs>;

const onAddRecharge = async ({
  ctx,
  input: { memberId, amount, remark, remarkEn },
}: {
  ctx: AppRouterContext;
  input: AddRechargeInputsSchemas;
}) => {
  const { getWallet, transferIn } = wallet(ctx);

  const walletAccount = await getWallet({
    walletType: WalletAccountType.MEMBER_POINTS,
    ownerType: WalletAccountOwner.MEMBER,
    ownerId: memberId,
  });

  const roudindAmount = new Decimal(amount).mul(
    new Decimal(walletAccount.rounding),
  );

  const rechargeRecord = await ctx.db.memberRechargeRecord.create({
    data: {
      recordType: RechargeRecordType.RECHARGE,
      operatorType: OperatorType.ADMIN,
      operatorId: ctx.session.userId,
      memberId,
      amount: roudindAmount.toNumber(),
      rounding: walletAccount.rounding,
      remark,
      remarkEn,
      comfirmed: true,
    },
  });

  await transferIn(
    { account: walletAccount },
    {
      subject: "RECHARGE",
      amount: rechargeRecord.amount,
      remark: rechargeRecord.remark,
      remarkEn: rechargeRecord.remarkEn,
      remarkI18n: false,
      voucherType: "MEMBER_RECHARGE_RECORD",
      voucher: String(rechargeRecord.id),
    },
  );
};

const DeductRechargeInputs = z.object({
  memberId: z.number(),
  amount: z.number(),
  remark: z.string(),
  remarkEn: z.string(),
});
type DeductRechargeInputsSchemas = z.infer<typeof DeductRechargeInputs>;

const onDeductRecharge = async ({
  ctx,
  input: { memberId, amount, remark, remarkEn },
}: {
  ctx: AppRouterContext;
  input: DeductRechargeInputsSchemas;
}) => {
  const { getWallet, transferOut } = wallet(ctx);

  const walletAccount = await getWallet({
    walletType: WalletAccountType.MEMBER_POINTS,
    ownerType: WalletAccountOwner.MEMBER,
    ownerId: memberId,
  });

  const roudindAmount = new Decimal(amount).mul(
    new Decimal(walletAccount.rounding),
  );

  const rechargeRecord = await ctx.db.memberRechargeRecord.create({
    data: {
      recordType: RechargeRecordType.DEDUCT,
      operatorType: OperatorType.ADMIN,
      operatorId: ctx.session.userId,
      memberId,
      amount: roudindAmount.toNumber(),
      rounding: walletAccount.rounding,
      remark,
      remarkEn,
      comfirmed: true,
    },
  });

  await transferOut(
    { account: walletAccount },
    {
      subject: "DEDUCT",
      amount: rechargeRecord.amount,
      remark: rechargeRecord.remark,
      remarkEn: rechargeRecord.remarkEn,
      remarkI18n: false,
      voucherType: "MEMBER_RECHARGE_RECORD",
      voucher: String(rechargeRecord.id),
    },
  );
};

export const MemberRouter = createTRPCRouter({
  createMember: protectedProcedure
    .input(CreateMemberInputs)
    .mutation(onCreateMember),
  updateMember: protectedProcedure
    .input(UpdateMemberInputs)
    .mutation(onUpdateMember),
  freezeMember: protectedProcedure
    .input(z.object({ id: z.number(), data: FreezeMemberInputs }))
    .mutation(onFreezeMember),
  unfreezeMember: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(onUnfreezeMember),
  findMember: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(onFindMember),
  pageMember: protectedProcedure
    .input(PageMemberInputs)
    .output(PageMemberOutputs)
    .query(onPageMember),
  addRecharge: protectedProcedure
    .input(AddRechargeInputs)
    .mutation(onAddRecharge),
  deductRecharge: protectedProcedure
    .input(DeductRechargeInputs)
    .mutation(onDeductRecharge),
  signIn: protectedProcedure
    .input(SignInInputs)
    .output(SignInOutputs)
    .mutation(onSignIn),
});
