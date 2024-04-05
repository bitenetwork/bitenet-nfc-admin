import { createClient } from "redis";
import { env } from "~/env.mjs";
import { logger } from "~/server/logger";

const globalForRedis = globalThis as unknown as {
  redis: ReturnType<typeof createClient> | undefined;
};

export const redis =
  globalForRedis.redis ??
  (await createClient({ url: env.REDIS_URL })
    .on("error", (err) => logger.error("Redis Client Error", err))
    .connect());

if (env.NODE_ENV !== "production") globalForRedis.redis = redis;
