import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";
import { env } from "~/env.mjs";
import _ from "lodash";
import { TRPCError } from "@trpc/server";
import { snsClient } from "~/server/sdk/sns";
import {
  CreatePlatformEndpointCommand,
  GetEndpointAttributesCommand,
  SetEndpointAttributesCommand,
} from "@aws-sdk/client-sns";
import { AwsSnsPushChannel } from "~/server/core/enums";
import pushing from "~/server/service/pushing";

const configs: Record<
  string,
  { name: string; pushChannel: string; arn: string }
> = {
  SNAPX_APP_IOS: {
    name: "SNAPX_APP_IOS",
    pushChannel: AwsSnsPushChannel.APNS,
    arn: env.AWS_SNS_ARN_IOS,
  },
  SNAPX_APP_ANDROID: {
    name: "SNAPX_APP_ANDROID",
    pushChannel: AwsSnsPushChannel.FCM,
    arn: env.AWS_SNS_ARN_ANDROID,
  },
};

const PATH_PREFIX = "/infra/pushing/aws";

// Swagger 接口标签分组定义
export const TAG = "2000 - 移动推送管理";

export const pushingRouter = createTRPCRouter({
  registerDevice: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/register-device`,
        tags: [TAG],
        protect: true,
        summary: "注册移动推送设备",
      },
    })
    .input(
      z.object({
        platform: z
          .string()
          .describe(
            "应用平台枚举：SNAPX_APP_IOS 苹果端； SNAPX_APP_ANDROID 安卓端",
          ),
        deviceToken: z.string().describe("设备token或者id"),
      }),
    )
    .output(z.void())
    .mutation(async ({ ctx, input: { platform, deviceToken } }) => {
      const config = configs[platform];
      if (!config) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "platform not exist",
        });
      }

      // 唯一键 platformAppArn + pushChanel + deviceToken
      // 唯一键冲突时，更新memberId，updateTime。当同一个设备上登录其他用户时memberId就会更新
      const memberId = ctx.session.userId;
      await ctx.db.awsSnsEndpoint.upsert({
        where: {
          platformAppArn_pushChannel_deviceToken: {
            platformAppArn: config.arn,
            pushChannel: config.pushChannel,
            deviceToken,
          },
        },
        update: {
          memberId,
          platform: config.name,
        },
        create: {
          memberId,
          platform: config.name,
          platformAppArn: config.arn,
          pushChannel: config.pushChannel,
          deviceToken,
          endpointArn: null,
        },
      });

      const endpointArn = await createEndpoint(config.arn, deviceToken);
      if (endpointArn) {
        await ctx.db.awsSnsEndpoint.update({
          data: { endpointArn },
          where: {
            platformAppArn_pushChannel_deviceToken: {
              platformAppArn: config.arn,
              pushChannel: config.pushChannel,
              deviceToken,
            },
          },
        });
      }
    }),
  publishMessage: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/publish-message`,
        tags: [TAG],
        protect: true,
        summary: "测试向当前用户推送消息",
      },
    })
    .input(
      z.object({
        message: z.string(),
      }),
    )
    .output(z.void())
    .mutation(async ({ ctx, input }) => {
      await pushing(ctx).publishByMemberId(ctx.session.userId, input.message);
    }),
});

const createEndpoint = async (
  platformApplicationArn: string,
  token: string,
) => {
  const response = await snsClient.send(
    new CreatePlatformEndpointCommand({
      PlatformApplicationArn: platformApplicationArn,
      Token: token,
    }),
  );

  const attributes = await snsClient.send(
    new GetEndpointAttributesCommand({ EndpointArn: response.EndpointArn }),
  );

  const enabled = attributes.Attributes?.Enabled;
  if (enabled === "false") {
    await snsClient.send(
      new SetEndpointAttributesCommand({
        EndpointArn: response.EndpointArn,
        Attributes: {
          Enabled: "true",
        },
      }),
    );
  }

  return response.EndpointArn;
};
