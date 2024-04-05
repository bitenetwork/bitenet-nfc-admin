import {
  CreateTopicCommand,
  DeleteTopicCommand,
  PublishCommand,
  SubscribeCommand,
} from "@aws-sdk/client-sns";
import {
  Notification,
  NotificationStatus,
  OperatorType,
  NotificationBillType,
  WalletAccountType,
  WalletAccountOwner,
  SmsPushRecord,
  ReceiverType,
} from "@prisma/client";
import { da } from "date-fns/locale";
import _ from "lodash";
import {
  MemberSchema,
  NotificationBillSchema,
  NotificationBillItemSchema,
  NotificationSchema,
} from "prisma/generated/zod";
import { z } from "zod";
import { DATA_NOT_EXIST, PARAMETER_ERROR, UNEXPECT } from "~/server/core/error";
import { AppRouterContext, asPageable } from "~/server/core/schema";
import { snsClient } from "~/server/sdk/sns";
import wallet from "~/server/service/wallet";

export const NotificationCreateInputsSchema = z.object({
  title: z.string().describe("标题"),
  context: z.string().describe("正文"),
  remark: z.string().describe("备注").nullable(),
  inSiteMessage: z.boolean().describe("站内信").default(false),
  appPush: z.boolean().describe("APP推送").default(false),
  smsPush: z.boolean().describe("SMS推送").default(false),
  memberIds: z.array(z.number()).describe("接受推送的客户id").optional(),
  receiverType: z
    .nativeEnum(ReceiverType)
    .describe("接收方类枚举：CUSTOMER：顾客；POTENTIAL 潜在顾客")
    .default(ReceiverType.CUSTOMER),
});
export type NotificationCreateInputs = z.infer<
  typeof NotificationCreateInputsSchema
>;

export const onCreateNotification = async ({
  ctx: baseCtx,
  input,
  operator,
}: {
  ctx: AppRouterContext;
  input: NotificationCreateInputs;
  operator?: OperatorType;
}) => {
  const [transational, ctx, txc] = baseCtx.decorators.useTransational(baseCtx);

  const operatorType = operator || OperatorType.RESTAUARNT;
  const operatorId = ctx.session.userId;
  const brandId =
    operatorType === OperatorType.RESTAUARNT ? ctx.session.brandId : 0;
  const restaurantId =
    operatorType === OperatorType.RESTAUARNT ? ctx.session.restaurantId : 0;
  if (brandId == null || restaurantId == null) {
    throw UNEXPECT();
  }

  return await txc.run(async () => {
    let { memberIds, ...rest } = input;
    memberIds = memberIds || [];

    const notification = await ctx.db.notification.create({
      data: {
        ...rest,
        operatorType,
        operatorId,
        brandId,
        restaurantId,
        status: NotificationStatus.DRAFT,
      },
    });
    const receiverCount = await updateNotificationReceiver({
      ctx: ctx as AppRouterContext,
      input: {
        notificationId: notification.id,
        brandId,
        restaurantId,
        memberIds,
      },
    });
    await ctx.db.notification.update({
      data: {
        receiverCount,
      },
      where: {
        id: notification.id,
      },
    });

    if (operatorType === OperatorType.RESTAUARNT) {
      const bill = await createNotificationBill({
        ctx: ctx as AppRouterContext,
        input: { notification },
      });
      if (!bill) {
        return notification;
      }
    }

    // 调用AWS接口创建推送TOPIC绑定订阅
    if (notification.smsPush) {
      await createSmsTopicAndSubscription({
        ctx: ctx as AppRouterContext,
        input: { notification },
      });
    }
    if (notification.appPush) {
      await createAppPushTopicAndSubscription({
        ctx: ctx as AppRouterContext,
        input: { notification },
      });
    }

    return notification;
  });
};

export const NotificationDeleteInputsSchema = z.object({
  id: z.number().describe("推送id"),
});
export type NotificationDeleteInputs = z.infer<
  typeof NotificationDeleteInputsSchema
>;

export const onDeleteNotification = async ({
  ctx: baseCtx,
  input,
}: {
  ctx: AppRouterContext;
  input: NotificationDeleteInputs;
}) => {
  const [transational, ctx, txc] = baseCtx.decorators.useTransational(baseCtx);
  return await txc.run(async () => {
    let notification = await ctx.db.notification.findUnique({
      where: { id: input.id },
    });
    if (!notification) {
      throw DATA_NOT_EXIST();
    }
    if (!(notification.status === NotificationStatus.DRAFT)) {
      throw PARAMETER_ERROR({
        message: "member:cantNotDeleteFinishedNotification",
      });
    }

    await ctx.db.notification.delete({ where: { id: input.id } });
    await ctx.db.notificationReceiver.deleteMany({
      where: { notificationId: input.id },
    });
    if (notification.operatorType === OperatorType.RESTAUARNT) {
      await deleteNotificationBill({
        ctx: ctx as AppRouterContext,
        input: { notificationId: input.id },
      });
    }

    // 调用AWS接口删除推送TOPIC
    if (notification.smsPush) {
      await deleteSmsTopic({
        ctx: ctx as AppRouterContext,
        input: { notification },
      });
    }
    if (notification.appPush) {
      await deleteappPushTopic({
        ctx: ctx as AppRouterContext,
        input: { notification },
      });
    }

    return notification;
  });
};

export const NotificationUpdateInputsSchema = z.object({
  id: z.number().describe("推送id"),
  title: z.string().describe("标题"),
  context: z.string().describe("正文"),
  remark: z.string().describe("备注").nullable(),
  inSiteMessage: z.boolean().describe("站内信").default(false),
  appPush: z.boolean().describe("APP推送").default(false),
  smsPush: z.boolean().describe("SMS推送").default(false),
  memberIds: z.array(z.number()).describe("接受推送的客户id").optional(),
});
export type NotificationUpdateInputs = z.infer<
  typeof NotificationUpdateInputsSchema
>;

export const onNotificationUpdate = async ({
  ctx: baseCtx,
  input,
}: {
  ctx: AppRouterContext;
  input: NotificationUpdateInputs;
}) => {
  const [transational, ctx, txc] = baseCtx.decorators.useTransational(baseCtx);
  const notification = await ctx.db.notification.findUnique({
    where: { id: input.id },
  });
  if (!notification) {
    throw DATA_NOT_EXIST();
  }
  if (!(notification.status === NotificationStatus.DRAFT)) {
    throw PARAMETER_ERROR();
  }
  const { id, memberIds, ...data } = input;
  return await txc.run(async () => {
    await ctx.db.notification.update({
      data,
      where: { id: input.id },
    });

    let { memberIds, ...rest } = input;
    if (memberIds) {
      const receiverCount = await updateNotificationReceiver({
        ctx: ctx as AppRouterContext,
        input: {
          notificationId: notification.id,
          brandId: notification.brandId,
          restaurantId: notification.restaurantId,
          memberIds,
        },
      });
      await ctx.db.notification.update({
        data: {
          receiverCount,
        },
        where: {
          id: notification.id,
        },
      });
    }

    await deleteNotificationBill({
      ctx: ctx as AppRouterContext,
      input: { notificationId: input.id },
    });
    await createNotificationBill({
      ctx: ctx as AppRouterContext,
      input: { notification: notification },
    });

    // 调用AWS接口更新推送TOPIC及更新绑定订阅
    if (notification.smsPush) {
      await deleteSmsTopic({
        ctx: ctx as AppRouterContext,
        input: { notification },
      });
      await createSmsTopicAndSubscription({
        ctx: ctx as AppRouterContext,
        input: { notification },
      });
    }
    if (notification.appPush) {
      await deleteappPushTopic({
        ctx: ctx as AppRouterContext,
        input: { notification },
      });
      await createAppPushTopicAndSubscription({
        ctx: ctx as AppRouterContext,
        input: { notification },
      });
    }

    return notification;
  });
};

export const NotificationFindInputsSchema = z.object({
  id: z.number().describe("推送id"),
});
export type NotificationFindInputs = z.infer<
  typeof NotificationFindInputsSchema
>;

export const NotificationFindOutputSchema =
  NotificationCreateInputsSchema.merge(NotificationSchema).extend({
    memberList: z.array(MemberSchema).describe("接收推送会员列表"),
    notificationBill: NotificationBillSchema.extend({
      notificationBillItems: z
        .array(NotificationBillItemSchema)
        .describe("账单明细"),
    })
      .nullish()
      .describe("推送产生的账单"),
  });

export const onFindNotification = async ({
  ctx,
  input: { id },
}: {
  ctx: AppRouterContext;
  input: NotificationFindInputs;
}) => {
  const notification = await ctx.db.notification.findUnique({ where: { id } });
  if (!notification) {
    return null;
  }
  const receiverList = await ctx.db.notificationReceiver.findMany({
    where: { notificationId: id },
  });
  const memberIds = receiverList.map((x) => x.memberId as number);
  const memberList = await ctx.db.member.findMany({
    where: { id: { in: memberIds } },
  });
  const notificationBill = await ctx.db.notificationBill.findUnique({
    include: { notificationBillItems: true },
    where: {
      notificationId_deleteAt: {
        notificationId: id,
        deleteAt: 0,
      },
    },
  });

  return {
    ...notification,
    memberIds,
    memberList,
    notificationBill,
  };
};

export const NotificationPageInputsSchema = asPageable(
  z.object({
    title: z.string().describe("推送title").optional(),
    receiverType: z
      .nativeEnum(ReceiverType)
      .describe("接收方类枚举：CUSTOMER：顾客；POTENTIAL 潜在顾客")
      .optional(),
  }),
);
export type NotificationPageInputs = z.infer<
  typeof NotificationPageInputsSchema
>;

export const onPageNotification = async ({
  ctx,
  input: { page, pageSize, title, receiverType },
  operator,
}: {
  ctx: AppRouterContext;
  input: NotificationPageInputs;
  operator?: OperatorType;
}) => {
  const operatorType = operator || OperatorType.RESTAUARNT;
  const restaurantId =
    operatorType === OperatorType.RESTAUARNT ? ctx.session.restaurantId : 0;
  const where = { restaurantId, title: { contains: title }, receiverType };
  const totalCount = await ctx.db.notification.count({ where });
  const pageCount = Math.ceil(totalCount / pageSize);
  if (totalCount === 0) {
    return {
      page,
      pageSize,
      pageCount,
      totalCount,
      record: [],
    };
  }
  const record = await ctx.db.notification.findMany({
    skip: (page - 1) * pageSize,
    take: pageSize,
    where,
    orderBy: { createAt: "desc" },
  });

  return {
    page,
    pageSize,
    pageCount,
    totalCount,
    record,
  };
};

export const NotificationSendInputsSchema = z.object({
  id: z.number().describe("推送id"),
});
export type NotificationSendInouts = z.infer<
  typeof NotificationSendInputsSchema
>;

export const onSendNotification = async ({
  ctx: baseCtx,
  input: { id },
}: {
  ctx: AppRouterContext;
  input: NotificationSendInouts;
}) => {
  const [transational, ctx, txc] = baseCtx.decorators.useTransational(baseCtx);
  const notification = await ctx.db.notification.findUnique({
    where: { id },
  });
  if (!notification) {
    throw DATA_NOT_EXIST();
  }

  await txc.run(async () => {
    const bill = await ctx.db.notificationBill.findUnique({
      where: {
        notificationId_deleteAt: {
          notificationId: id,
          deleteAt: 0,
        },
      },
    });

    if (bill && notification.brandId && notification.brandId !== 0) {
      const { getWallet, transferOut } = wallet(ctx as AppRouterContext);
      const walletAccount = await getWallet({
        walletType: WalletAccountType.RESTAUARNT_PRE_RECHARGE,
        ownerType: WalletAccountOwner.RESTAUARNT,
        ownerId: notification.brandId,
      });
      await transferOut(
        { account: walletAccount },
        {
          subject: "CONSUME_SEND_NOTIFICATION",
          amount: bill.totalPrice,
          remark: "wallet:SendNotificationCost",
          remarkEn: null,
          remarkI18n: true,
          voucherType: "NOTIFICATION_BILL",
          voucher: String(bill.id),
        },
      );
    }

    await ctx.db.notification.update({
      data: {
        status: NotificationStatus.PROCESS,
      },
      where: {
        id: notification.id,
      },
    });

    // 冗余后台短信发送记录报表
    if (notification.smsPush) {
      const receiverList = await ctx.db.notificationReceiver.findMany({
        where: {
          notificationId: notification.id,
          smsPushSubArn: { not: null },
        },
      });
      const memberIdList = receiverList.map((x) => x.memberId as number);
      const memberList = await ctx.db.member.findMany({
        where: { id: { in: memberIdList } },
      });
      const memberMap = Object.fromEntries(memberList.map((x) => [x.id, x]));
      const data = [];
      const now = new Date();
      for (const item of receiverList) {
        if (!item.memberId) {
          continue;
        }

        const member = memberMap[item.memberId];
        if (!member) {
          continue;
        }

        data.push({
          memberId: member.id,
          notificationId: item.notificationId,
          brandId: item.brandId,
          restaurantId: item.restaurantId,
          notificationReceiverId: item.id,
          context: notification.context,
          phoneAreaCode: member.phoneAreaCode,
          phone: member.phone,
          pushTime: now,
        });
      }
      await ctx.db.smsPushRecord.createMany({ data });
    }
  });

  try {
    // 发送推送

    if (notification.inSiteMessage) {
      await sendInSiteMessage({
        ctx: ctx as AppRouterContext,
        input: { notification },
      });
    }

    if (notification.smsPush) {
      await sendSnsNotification({
        ctx: ctx as AppRouterContext,
        input: { notification },
      });
    }
    if (notification.appPush) {
      await sendAppPushNotification({
        ctx: ctx as AppRouterContext,
        input: { notification, data: {} },
      });
    }
  } catch (e) {
    ctx.logger.error(e);
    await txc.run(async () => {
      const bill = await ctx.db.notificationBill.findUnique({
        where: {
          notificationId_deleteAt: {
            notificationId: id,
            deleteAt: 0,
          },
        },
      });

      if (bill && bill.brandId) {
        const { getWallet, transferIn } = wallet(ctx as AppRouterContext);
        const walletAccount = await getWallet({
          walletType: WalletAccountType.RESTAUARNT_PRE_RECHARGE,
          ownerType: WalletAccountOwner.RESTAUARNT,
          ownerId: bill.brandId,
        });
        await transferIn(
          { account: walletAccount },
          {
            subject: "REFUND_SEND_NOTIFICATION",
            amount: bill.totalPrice,
            remark: "wallet:RefundSendNotificationCost",
            remarkEn: null,
            remarkI18n: true,
            voucherType: "NOTIFICATION_BILL",
            voucher: String(bill.id),
          },
        );
      }

      await ctx.db.notification.update({
        data: {
          status: NotificationStatus.FAIL,
        },
        where: {
          id: notification.id,
        },
      });
    });

    // TODO 抛出发送失败提示
  }

  await ctx.db.notification.update({
    data: {
      status: NotificationStatus.DONE,
    },
    where: {
      id: notification.id,
    },
  });
};

const NotificationBillCreateInputsSchema = z.object({
  notification: NotificationSchema,
});
type NotificationBillCreateInputs = z.infer<
  typeof NotificationBillCreateInputsSchema
>;

const createNotificationBill = async ({
  ctx,
  input: { notification },
}: {
  ctx: AppRouterContext;
  input: NotificationBillCreateInputs;
}) => {
  const globalConfig = await ctx.db.globalConfig.findUnique({
    where: { id: 1 },
  });
  if (!globalConfig?.pushFeeApp || !globalConfig.pushFeeSms) {
    throw UNEXPECT();
  }
  const unitPriceMap = {
    [NotificationBillType.IN_SITE_MESSAGE]: 0,
    [NotificationBillType.APP_PUSH]: globalConfig.pushFeeApp,
    [NotificationBillType.SMS_PUSH]: globalConfig.pushFeeSms,
  };

  const { id: notificationId, brandId, restaurantId } = notification;
  const receiverList = await ctx.db.notificationReceiver.findMany({
    where: { notificationId },
  });
  const memberIds = receiverList.map((x) => x.memberId as number);
  if (_.size(memberIds) === 0) {
    return null;
  }

  const endpointList = await ctx.db.awsSnsEndpoint.findMany({
    where: { memberId: { in: memberIds } },
  });
  const endpointGrouping = _.groupBy(endpointList, (x) => x.memberId);

  const memberList = await ctx.db.member.findMany({
    where: { id: { in: memberIds } },
  });
  const phoneList = memberList
    .filter((x) => x.phoneAreaCode && x.phone)
    .map(({ phoneAreaCode, phone }) => `${phoneAreaCode}${phone}`);

  const items: {
    type: NotificationBillType;
    quantity: number;
  }[] = [];
  if (notification.inSiteMessage) {
    items.push({
      type: NotificationBillType.IN_SITE_MESSAGE,
      quantity: _.size(receiverList),
    });
  }
  if (notification.appPush) {
    items.push({
      type: NotificationBillType.APP_PUSH,
      quantity: _.size(endpointGrouping),
    });
  }
  if (notification.smsPush) {
    items.push({
      type: NotificationBillType.SMS_PUSH,
      quantity: _.size(phoneList),
    });
  }

  const billItem = items.map((x) => ({
    ...x,
    notificationId,
    brandId,
    restaurantId,
    unitPrice: unitPriceMap[x.type],
    totalPrice: x.quantity * unitPriceMap[x.type],
  }));
  const totalPrice = billItem
    .map((x) => x.totalPrice)
    .reduce((a, b) => a + b, 0);
  return await ctx.db.notificationBill.create({
    data: {
      notificationId,
      brandId,
      restaurantId,
      totalPrice,
      notificationBillItems: {
        create: billItem,
      },
    },
  });
};

const deleteNotificationBill = async ({
  ctx,
  input: { notificationId },
}: {
  ctx: AppRouterContext;
  input: { notificationId: number };
}) => {
  const bill = await ctx.db.notificationBill.findUnique({
    where: {
      notificationId_deleteAt: {
        notificationId,
        deleteAt: 0,
      },
    },
  });
  if (!bill) {
    return;
  }
  await ctx.db.notificationBill.delete({
    where: {
      notificationId_deleteAt: {
        notificationId,
        deleteAt: 0,
      },
    },
  });
};

const NotificationReceiverUpdateInputsSchema = z.object({
  notificationId: z.number(),
  brandId: z.number().nullish(),
  restaurantId: z.number().nullish(),
  memberIds: z.array(z.number()),
});
type NotificationReceiverUpdateInputs = z.infer<
  typeof NotificationReceiverUpdateInputsSchema
>;

const updateNotificationReceiver = async ({
  ctx,
  input: { notificationId, brandId, restaurantId, memberIds },
}: {
  ctx: AppRouterContext;
  input: NotificationReceiverUpdateInputs;
}) => {
  // TODO memberIds为空时，查询出餐厅下所有顾客，转为memberIds
  const memberList = await ctx.db.member.findMany({
    where: { id: { in: memberIds } },
  });
  const notificationReceivers = memberList.map((x) => ({
    notificationId,
    brandId,
    restaurantId,
    memberId: x.id,
  }));
  await ctx.db.notificationReceiver.deleteMany({ where: { notificationId } });
  return (
    await ctx.db.notificationReceiver.createMany({
      data: notificationReceivers,
    })
  ).count;
};

const deleteSmsTopic = async ({
  ctx,
  input: { notification },
}: {
  ctx: AppRouterContext;
  input: { notification: Notification };
}) => {
  if (!notification.smsPushTopicArn) {
    return;
  }
  await snsClient.send(
    new DeleteTopicCommand({
      TopicArn: notification.smsPushTopicArn,
    }),
  );
};

const createSmsTopicAndSubscription = async ({
  ctx,
  input: { notification },
}: {
  ctx: AppRouterContext;
  input: { notification: Notification };
}) => {
  const topicResponse = await snsClient.send(
    new CreateTopicCommand({
      Name: `SMS-PUSH-${notification.id}`,
    }),
  );
  const smsPushTopicArn = topicResponse.TopicArn;
  await ctx.db.notification.update({
    data: {
      smsPushTopicArn,
    },
    where: {
      id: notification.id,
    },
  });

  const receivers = await ctx.db.notificationReceiver.findMany({
    where: {
      notificationId: notification.id,
    },
  });
  const memberIds = receivers.map((x) => x.memberId as number);
  const memberList = await ctx.db.member.findMany({
    where: {
      id: {
        in: memberIds,
      },
    },
  });
  const memberIdPhoneMap = Object.fromEntries(
    memberList.map(({ id, phoneAreaCode, phone }) => [
      id,
      `${phoneAreaCode}${phone}`,
    ]),
  );
  for (const receiver of receivers) {
    const phone = receiver.memberId && memberIdPhoneMap[receiver.memberId];
    if (!phone) {
      continue;
    }
    const subscription = await snsClient.send(
      new SubscribeCommand({
        Protocol: "sms",
        Endpoint: phone,
        ReturnSubscriptionArn: true,
        TopicArn: smsPushTopicArn,
      }),
    );
    await ctx.db.notificationReceiver.update({
      data: {
        smsPushSubArn: subscription.SubscriptionArn,
      },
      where: {
        id: receiver.id,
      },
    });
  }
};

const sendSnsNotification = async ({
  ctx,
  input: { notification },
}: {
  ctx: AppRouterContext;
  input: { notification: Notification };
}) => {
  if (!notification.smsPushTopicArn) {
    return;
  }
  await snsClient.send(
    new PublishCommand({
      MessageAttributes: {
        "AWS.SNS.SMS.SMSType": {
          DataType: "String",
          StringValue: "Transactional",
        },
        "AWS.SNS.SMS.SenderID": {
          DataType: "String",
          StringValue: "BITENET",
        },
      },
      Message: `[BITENET] ${notification.context}`,
      TopicArn: notification.smsPushTopicArn,
    }),
  );
  await ctx.db.notification.update({
    data: {
      status: NotificationStatus.DONE,
    },
    where: {
      id: notification.id,
    },
  });
};

const deleteappPushTopic = async ({
  ctx,
  input: { notification },
}: {
  ctx: AppRouterContext;
  input: { notification: Notification };
}) => {
  if (!notification.appPushTopicArn) {
    return;
  }
  await snsClient.send(
    new DeleteTopicCommand({
      TopicArn: notification.appPushTopicArn,
    }),
  );
};

const createAppPushTopicAndSubscription = async ({
  ctx,
  input: { notification },
}: {
  ctx: AppRouterContext;
  input: { notification: Notification };
}) => {
  const topicResponse = await snsClient.send(
    new CreateTopicCommand({
      Name: `APP-PUSH-${notification.id}`,
    }),
  );
  const appPushTopicArn = topicResponse.TopicArn;
  await ctx.db.notification.update({
    data: {
      appPushTopicArn,
    },
    where: {
      id: notification.id,
    },
  });

  const receivers = await ctx.db.notificationReceiver.findMany({
    where: {
      notificationId: notification.id,
    },
  });
  const memberIds = receivers.map((x) => x.memberId as number);
  const awsSnsEndpointList = await ctx.db.awsSnsEndpoint.findMany({
    where: {
      memberId: {
        in: memberIds,
      },
    },
  });
  const memberIdDeviceTokenMap = Object.fromEntries(
    awsSnsEndpointList.map(({ memberId, endpointArn }) => [
      memberId,
      endpointArn,
    ]),
  );
  for (const receiver of receivers) {
    const endpointArn =
      receiver.memberId && memberIdDeviceTokenMap[receiver.memberId];
    if (!endpointArn) {
      continue;
    }
    const subscription = await snsClient.send(
      new SubscribeCommand({
        Protocol: "application",
        Endpoint: endpointArn,
        ReturnSubscriptionArn: true,
        TopicArn: appPushTopicArn,
      }),
    );
    await ctx.db.notificationReceiver.update({
      data: {
        appPushSubArn: subscription.SubscriptionArn,
      },
      where: {
        id: receiver.id,
      },
    });
  }
};

const sendAppPushNotification = async ({
  ctx,
  input: { notification, data },
}: {
  ctx: AppRouterContext;
  input: { notification: Notification; data: Record<string, unknown> };
}) => {
  if (!notification.appPushTopicArn) {
    return;
  }
  await snsClient.send(
    new PublishCommand({
      TopicArn: notification.appPushTopicArn,
      MessageStructure: "json",
      Message: JSON.stringify({
        default: `${notification.context}`,
        APNS: JSON.stringify({
          aps: {
            alert: `${notification.context}`,
            ...data,
          },
        }),
        GCM: JSON.stringify({
          data: {
            message: `${notification.context}`,
            ...data,
          },
        }),
      }),
    }),
  );
  await ctx.db.notification.update({
    data: {
      status: NotificationStatus.DONE,
    },
    where: {
      id: notification.id,
    },
  });
};

const sendInSiteMessage = async ({
  ctx,
  input: { notification },
}: {
  ctx: AppRouterContext;
  input: { notification: Notification };
}) => {
  if (!notification) {
    return;
  }
  const receivers = await ctx.db.notificationReceiver.findMany({
    where: {
      notificationId: notification.id,
    },
  });

  let source = "RESTAUARNT";
  switch (notification.operatorType) {
    case "ADMIN":
      source = "ADMIN";
      break;
    case "RESTAUARNT":
      source = "RESTAUARNT";
      break;
    case "CUSTOMER":
      source = "CUSTOMER";
      break;
  }

  await ctx.db.inSiteMessage.createMany({
    data: receivers.map(({ memberId }) => ({
      source,
      restaurantId: notification.restaurantId || 0,
      restaurantUserId: notification.operatorId,
      subject: "GENERAL",
      title: notification.title,
      context: notification.context,
      relateId: notification.id,
      toMemberId: memberId as number,
    })),
  });
};
