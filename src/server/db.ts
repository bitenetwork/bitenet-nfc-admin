import { PrismaClient } from "@prisma/client";

import { env } from "~/env.mjs";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;

db.$use(async (params, next) => {
  const now = Math.floor(Date.now() / 1000);
  if (params.action === "delete") {
    // 将 delete 操作转换为 update 操作
    params.action = "update";
    params.args["data"] = { deleteAt: now };
  } else if (params.action === "deleteMany") {
    // 将 deleteMany 操作转换为 updateMany 操作
    params.action = "updateMany";
    if (params.args.data) {
      params.args.data["deleteAt"] = now;
    } else {
      params.args["data"] = { deleteAt: now };
    }
  }

  // 对于查询操作
  if (
    params.action === "findUnique" ||
    params.action === "findFirst" ||
    params.action === "findMany" ||
    params.action === "findFirstOrThrow" ||
    params.action === "findUniqueOrThrow" ||
    params.action === "count"
  ) {
    // 确保 'where' 子句存在
    if (!params.args.where) {
      params.args.where = {};
    }
    params.args.where["deleteAt"] = 0;
  }

  return next(params);
});
