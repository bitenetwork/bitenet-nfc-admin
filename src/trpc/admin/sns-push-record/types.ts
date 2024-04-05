import { type RouterInputs, type RouterOutputs } from "~/trpc/shared";

export type PageSmsPushRecordInputs =
  RouterInputs["smsPushRecord"]["pageSmsPushRecord"];
export type PageSmsPushRecordOutputs =
  RouterOutputs["smsPushRecord"]["pageSmsPushRecord"]["record"][number];
