import { S3Client } from "@aws-sdk/client-s3";
import { env } from "~/env.mjs";

const globalForPrisma = globalThis as unknown as {
  s3Client: S3Client | undefined;
};

export const s3Client =
  globalForPrisma.s3Client ??
  new S3Client({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  });

if (env.NODE_ENV !== "production") globalForPrisma.s3Client = s3Client;
