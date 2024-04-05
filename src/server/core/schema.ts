import { PrismaClient } from "@prisma/client";
import { IncomingHttpHeaders } from "http";
import { TFunction } from "i18next";
import { RedisClientType } from "redis";
import { type Logger } from "winston";
import { z } from "zod";
import { UserSession } from "~/server/session";
import { DecoratorFactory } from "./decorator";

export const Pageable = z.object({
  page: z.number().default(1),
  pageSize: z.number().default(30),
});

export const asPageable = <T extends ReturnType<typeof z.object>>(type: T) => {
  return Pageable.merge(type);
};

export const asPagedResult = <T extends z.ZodTypeAny>(recordType: T) => {
  return z.object({
    page: z.number(),
    pageSize: z.number(),
    pageCount: z.number(),
    totalCount: z.number(),
    record: z.array(recordType),
  });
};

export interface AppRouterContext {
  requestId: string;
  logger: Logger;
  session: UserSession;
  headers: IncomingHttpHeaders;
  db: PrismaClient;
  redis: RedisClientType;
  i18n?: TFunction;
  decorators: DecoratorFactory;
}

export type Decorator = <IN extends any[], OUT>(
  f: (...args: IN) => Promise<OUT>,
) => (...args: IN) => Promise<OUT>;
