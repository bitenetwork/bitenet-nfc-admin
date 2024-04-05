import { redis } from "~/server/redis";
import _ from "lodash";
import { env } from "~/env.mjs";
import { snsClient } from "./sdk/sns";
import { PublishCommand } from "@aws-sdk/client-sns";
import { logger } from "~/server/logger";

export enum CaptchaApp {
  ADMIN = "ADMIN",
  CUSTOMER = "CUSTOMER",
  RESTAURANT = "RESTAURANT",
}

export enum CaptchaScene {
  SIGN_UP = "SIGN_UP",
  SIGN_IN = "SIGN_IN",
  MODIFY_PASSWORD = "MODIFY_PASSWORD",
  FORGOT_PASSWORD = "FORGOT_PASSWORD",
  BIND_PHONE = "BIND_PHONE",
}

export enum CaptchaChannel {
  EMAIL = "EMAIL",
  SMS = "SMS",
}

const expire = 600;

export const useCaptcha = (
  app: CaptchaApp,
  scene: CaptchaScene,
  channel: CaptchaChannel,
) => {
  const keyBuilder = getKeyBuilder(app, scene, channel);
  const send = getSender(app, scene, channel);
  return {
    send: async (receiver: string) => {
      const code = genCode();
      const key = keyBuilder(receiver);
      await redis.set(key, code, { EX: expire });
      if (env.CONST_CAPTCHA === 0) {
        await send(receiver, code);
      }
      return {
        app,
        scene,
        channel,
        receiver,
        expireAt: new Date(Date.now() + expire * 1000),
      };
    },
    verify: async (receiver: string, code: string) =>
      code === (await redis.get(keyBuilder(receiver))),
    clean: async (receiver: string) => await redis.del(keyBuilder(receiver)),
  };
};

const genCode = () =>
  env.CONST_CAPTCHA === 1
    ? "000000"
    : String(_.random(0, 999999)).padStart(6, "0");

const getKeyBuilder =
  (app: CaptchaApp, scene: CaptchaScene, channel: CaptchaChannel) =>
  (receiver: string) =>
    `CAPTCHA:${app}:${scene}:${channel}:${receiver}`;

const getSender =
  (app: CaptchaApp, scene: CaptchaScene, channel: CaptchaChannel) =>
  async (receiver: string, code: string) => {
    logger.info(`${receiver}:${code}`);
    await snsClient.send(
      new PublishCommand({
        MessageAttributes: {
          "AWS.SNS.SMS.SMSType": {
            DataType: "String",
            StringValue: "Transactional",
          },
        },
        PhoneNumber: receiver,
        Message: `[BITENET] ${code} is your BITENET verification code. This code will expire in ${
          expire / 60
        } minutes.`,
      }),
    );
  };
