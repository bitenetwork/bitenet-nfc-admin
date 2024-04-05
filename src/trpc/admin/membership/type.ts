import { type RouterInputs, type RouterOutputs } from "~/trpc/shared";

export type CreateMemberInputs = RouterInputs["member"]["createMember"];
export type CreateMemberOutputs = RouterOutputs["member"]["createMember"];

export type UpdateMemberInputs = RouterInputs["member"]["updateMember"]["data"];
export type UpdateMemberOutputs = RouterOutputs["member"]["updateMember"];

export type FindMemberInputs = RouterInputs["member"]["findMember"];
export type FindMemberOutputs = RouterOutputs["member"]["findMember"];

export type PageMemberInputs = RouterInputs["member"]["pageMember"];
export type PageMemberResult = RouterOutputs["member"]["pageMember"];
export type PageMemberOutputs =
  RouterOutputs["member"]["pageMember"]["record"][number];

export type AddMemberRechargeInputs = RouterInputs["member"]["addRecharge"];
export type DeductMemberRechargeInputs =
  RouterInputs["member"]["deductRecharge"];

export type PageMemberWalletPointsTransationInputs =
  RouterInputs["memberWalletPoints"]["pageTransation"];
export type PageMemberWalletPointsTransationResult =
  RouterOutputs["memberWalletPoints"]["pageTransation"];
export type PageMemberWalletPointsTransationOutputs =
  RouterOutputs["memberWalletPoints"]["pageTransation"]["record"][number];

export type PageMemberNotificationInputs =
  RouterInputs["notitfication"]["pageNotification"];
export type PageMemberNotificationResult =
  RouterOutputs["notitfication"]["pageNotification"];
export type PageMemberNotificationOutputs =
  RouterOutputs["notitfication"]["pageNotification"]["record"][number];

export type CreateMemberNotificationInputs =
  RouterInputs["notitfication"]["createNotification"];
export type CreateMemberNotificationOutputs =
  RouterOutputs["notitfication"]["createNotification"];

export type UpdateMemberNotificationInputs =
  RouterInputs["notitfication"]["updateNotification"];
export type UpdateMemberNotificationOutputs =
  RouterOutputs["notitfication"]["updateNotification"];

export type PageSignInRecordInputs =
  RouterInputs["nfcSignInRouter"]["pageSignIn"];
export type PageSignInRecordResult =
  RouterOutputs["nfcSignInRouter"]["pageSignIn"];
export type PageSignInRecordOutputs =
  RouterOutputs["nfcSignInRouter"]["pageSignIn"]["record"][number];

export type MemberSignInInputs = RouterInputs["member"]["signIn"];
export type MemberSignInOutputs = RouterOutputs["member"]["signIn"];
