import {
  WalletAccount,
  WalletAccountType,
  WalletBalanceType,
  WalletTransation,
  WalletTransationDirection,
} from "@prisma/client";
import { type AppRouterContext } from "~/server/core/schema";
import { adapter, combind, decorate } from "~/server/core/utils";
import { PARAMETER_ERROR } from "../core/error";

type CreateWalletOptions = Pick<
  WalletAccount,
  "walletType" | "ownerType" | "ownerId" | "rounding"
>;

type GetWalletOptions = Omit<CreateWalletOptions, "rounding">;

type WalletAccountCreateHandler = (
  options: GetWalletOptions,
) => Promise<WalletAccount>;

type WalletAccountCreatePostHandler = (
  walletAccount: WalletAccount,
) => Promise<WalletAccount>;

const buildWalletAccountCreator =
  (
    createHandler: WalletAccountCreateHandler,
    postHandler: WalletAccountCreatePostHandler,
  ) =>
  async (options: GetWalletOptions) =>
    await postHandler(
      await createHandler({
        ...options,
      }),
    );

export type TransferAccount = {
  account: WalletAccount;
  balanceType?: WalletBalanceType;
};

export type TransationDetail = Pick<
  WalletTransation,
  | "subject"
  | "amount"
  | "remark"
  | "remarkEn"
  | "remarkI18n"
  | "voucherType"
  | "voucher"
>;

export default function (baseCtx: AppRouterContext) {
  const [unexpectErrorHandled, errCtx] =
    baseCtx.decorators.useUnexpectErrorHandled(baseCtx);
  const [transational, ctx] = baseCtx.decorators.useTransational(errCtx);

  const createWalletAccount = async (options: CreateWalletOptions) =>
    await ctx.db.walletAccount.create({
      data: {
        ...options,
      },
    });

  const createConsumableBalance = async (walletAccount: WalletAccount) => {
    const {
      id: walletAccountId,
      walletType,
      ownerType,
      ownerId,
      rounding,
    } = walletAccount;
    await ctx.db.walletBalance.create({
      data: {
        walletAccountId,
        walletType,
        ownerType,
        ownerId,
        rounding,
        balanceType: "CONSUMABLE",
        balance: 0,
        totalDebit: 0,
        totalCredit: 0,
      },
    });
    return walletAccount;
  };

  const getWallet = async (options: GetWalletOptions) => {
    const wallet = await findWalletAccount(options);
    if (wallet) {
      return wallet;
    }
    return await walletAccountCreateStrategy[options.walletType](options);
  };

  const findWalletAccount = async (
    walletType_ownerType_ownerId: GetWalletOptions,
  ) => {
    return await ctx.db.walletAccount.findUnique({
      where: {
        walletType_ownerType_ownerId,
      },
    });
  };

  const walletAccountCreateStrategy: Record<
    WalletAccountType,
    WalletAccountCreateHandler
  > = {
    MEMBER_POINTS: buildWalletAccountCreator(
      adapter(createWalletAccount, {
        rounding: 100,
      }),
      combind(createConsumableBalance),
    ),
    RESTAUARNT_PRE_RECHARGE: buildWalletAccountCreator(
      adapter(createWalletAccount, {
        rounding: 100,
      }),
      combind(createConsumableBalance),
    ),
  };

  const transfer = async (
    fromAccount: TransferAccount,
    toAccount: TransferAccount,
    transation: TransationDetail,
  ) => {
    await transferOut(fromAccount, transation);
    await transferIn(toAccount, transation);
  };

  const transferIn = async (
    { account, balanceType }: TransferAccount,
    transation: TransationDetail,
  ) => {
    balanceType = balanceType || WalletBalanceType.CONSUMABLE;
    const {
      id: walletAccountId,
      walletType,
      ownerType,
      ownerId,
      rounding,
    } = account;
    const { voucherType, voucher, amount } = transation;
    const transationDirection = WalletTransationDirection.DEBIT;
    const existed = await ctx.db.walletTransation.findUnique({
      where: {
        walletAccountId_transationDirection_voucherType_voucher: {
          walletAccountId,
          transationDirection,
          voucherType,
          voucher,
        },
      },
    });
    if (existed) {
      throw PARAMETER_ERROR({ message: "wallet:transferInvVoucherExisted" });
    }

    const walletBalance = await ctx.db.walletBalance.findUnique({
      where: {
        walletAccountId_balanceType: {
          walletAccountId,
          balanceType,
        },
      },
    });
    if (!walletBalance) {
      throw PARAMETER_ERROR({ message: "wallet:transferInMissBalance" });
    }
    const { balance: balanceBefore, id: walletBalanceId } = walletBalance;
    const { balance: balanceAfter } = await ctx.db.walletBalance.update({
      data: {
        balance: {
          increment: amount,
        },
        totalDebit: {
          increment: amount,
        },
      },
      where: {
        walletAccountId_balanceType: {
          walletAccountId,
          balanceType,
        },
      },
    });

    return await ctx.db.walletTransation.create({
      data: {
        walletAccountId,
        walletType,
        ownerType,
        ownerId,
        rounding,
        walletBalanceId,
        balanceType,
        transationDirection,
        balanceBefore,
        balanceAfter,
        ...transation,
      },
    });
  };

  const transferOut = async (
    { account, balanceType }: TransferAccount,
    transation: TransationDetail,
  ) => {
    balanceType = balanceType || WalletBalanceType.CONSUMABLE;
    const {
      id: walletAccountId,
      walletType,
      ownerType,
      ownerId,
      rounding,
    } = account;
    const { voucherType, voucher, amount } = transation;
    const transationDirection = WalletTransationDirection.CREDIT;
    const existed = await ctx.db.walletTransation.findUnique({
      where: {
        walletAccountId_transationDirection_voucherType_voucher: {
          walletAccountId,
          transationDirection,
          voucherType,
          voucher,
        },
      },
    });
    if (existed) {
      throw PARAMETER_ERROR({ message: "wallet:transferOutVoucherExisted" });
    }

    const walletBalance = await ctx.db.walletBalance.findUnique({
      where: {
        walletAccountId_balanceType: {
          walletAccountId,
          balanceType,
        },
      },
    });
    if (!walletBalance) {
      throw PARAMETER_ERROR({ message: "wallet:transferOutMissBalance" });
    }
    if (walletBalance.balance < amount) {
      throw PARAMETER_ERROR({ message: "wallet:transferOutBalanceNotEnough" });
    }
    const { balance: balanceBefore, id: walletBalanceId } = walletBalance;
    const { balance: balanceAfter } = await ctx.db.walletBalance.update({
      data: {
        balance: {
          decrement: amount,
        },
        totalCredit: {
          increment: amount,
        },
      },
      where: {
        walletAccountId_balanceType: {
          walletAccountId,
          balanceType,
        },
      },
    });
    if (balanceAfter < 0) {
      throw PARAMETER_ERROR({ message: "wallet:transferOutBalanceNotEnough" });
    }

    return await ctx.db.walletTransation.create({
      data: {
        walletAccountId,
        walletType,
        ownerType,
        ownerId,
        rounding,
        walletBalanceId,
        balanceType,
        transationDirection,
        balanceBefore,
        balanceAfter,
        ...transation,
      },
    });
  };

  const getBalance = async (options: GetWalletOptions) => {
    const wallet = await getWallet(options);
    const balance = await ctx.db.walletBalance.findUnique({
      where: {
        walletAccountId_balanceType: {
          walletAccountId: wallet.id,
          balanceType: WalletBalanceType.CONSUMABLE,
        },
      },
    });
    return balance?.balance || 0;
  };

  return {
    getWallet: decorate(getWallet, transational, unexpectErrorHandled),
    transfer: decorate(transfer, transational, unexpectErrorHandled),
    transferIn: decorate(transferIn, transational, unexpectErrorHandled),
    transferOut: decorate(transferOut, transational, unexpectErrorHandled),
    getBalance: decorate(getBalance, transational, unexpectErrorHandled),
  };
}
