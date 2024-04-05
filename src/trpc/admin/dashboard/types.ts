import { type RouterInputs, type RouterOutputs } from "~/trpc/shared";

// 首页统计
export type StatisticsOutputs =
  RouterOutputs["statistics"]["getStatisticsCountData"];
