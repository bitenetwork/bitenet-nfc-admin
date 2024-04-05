import { AwsSnsEndpoint } from "@prisma/client";
import _ from "lodash";
import { type AppRouterContext } from "~/server/core/schema";
import { AwsSnsPushChannel } from "~/server/core/enums";
import { snsClient } from "~/server/sdk/sns";
import { PublishCommand } from "@aws-sdk/client-sns";

export default function (ctx: AppRouterContext) {
  const publishByMemberId = async (
    memberId: number,
    message: string,
    data: Record<string, unknown> = {},
  ) => {
    const awsSnsEndpointList = await ctx.db.awsSnsEndpoint.findMany({
      where: { memberId },
    });
    await publish(awsSnsEndpointList, message, data);
  };

  const publish = async (
    awsSnsEndpointList: AwsSnsEndpoint[],
    message: string,
    data: Record<string, unknown> = {},
  ) => {
    await Promise.all(
      awsSnsEndpointList
        .filter((x) => !_.isEmpty(x.endpointArn))
        .map(async (awsSnsEndpoint) => {
          if (AwsSnsPushChannel.APNS === awsSnsEndpoint.pushChannel) {
            const response = await snsClient.send(
              new PublishCommand({
                TargetArn: awsSnsEndpoint.endpointArn || undefined,
                MessageStructure: "json",
                Message: JSON.stringify({
                  APNS: JSON.stringify({
                    aps: {
                      alert: message,
                      ...data,
                    },
                  }),
                }),
              }),
            );
            ctx.logger.info(
              "publish message success messageId:[%s] sequenceNumber:[%s] awsSnsEndpointList:[%s] message:[%s]",
              response.MessageId,
              response.SequenceNumber,
              awsSnsEndpointList,
              message,
            );
          } else if (AwsSnsPushChannel.FCM === awsSnsEndpoint.pushChannel) {
            const response = await snsClient.send(
              new PublishCommand({
                TargetArn: awsSnsEndpoint.endpointArn || undefined,
                MessageStructure: "json",
                Message: JSON.stringify({
                  GCM: JSON.stringify({
                    data: {
                      message: message,
                      ...data,
                    },
                  }),
                }),
              }),
            );
            ctx.logger.info(
              "publish message success messageId:[%s] sequenceNumber:[%s] awsSnsEndpointList:[%s] message:[%s]",
              response.MessageId,
              response.SequenceNumber,
              awsSnsEndpointList,
              message,
            );
          } else {
            const response = await snsClient.send(
              new PublishCommand({
                TargetArn: awsSnsEndpoint.endpointArn || undefined,
                Message: message,
              }),
            );
            ctx.logger.info(
              "publish message success messageId:[%s] sequenceNumber:[%s] awsSnsEndpointList:[%s] message:[%s]",
              response.MessageId,
              response.SequenceNumber,
              awsSnsEndpointList,
              message,
            );
          }
        }),
    );
  };

  return { publishByMemberId, publish };
}
