import { type RouterInputs, type RouterOutputs } from "~/trpc/shared";

export type QuerySysUserInputs = RouterInputs["sysUser"]["querySysUser"];
export type QuerySysUserOutputs =
  RouterOutputs["sysUser"]["querySysUser"]["record"][number];
export type CreateSysUserInput = RouterInputs["sysUser"]["createSysUser"];
export type UpdateSysUserInput =
  RouterInputs["sysUser"]["updateSysUser"]["data"];
