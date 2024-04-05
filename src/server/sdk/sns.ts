import { SNSClient } from "@aws-sdk/client-sns";
import { env } from "~/env.mjs";

const globalForPrisma = globalThis as unknown as {
  snsClient: SNSClient | undefined;
};

export const snsClient =
  globalForPrisma.snsClient ??
  new SNSClient({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  });

if (env.NODE_ENV !== "production") globalForPrisma.snsClient = snsClient;
