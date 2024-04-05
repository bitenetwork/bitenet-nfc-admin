import { asPagedResult } from "~/server/core/schema";
import { createTRPCRouter, protectedProcedure } from "../../trpc";
import { NotificationSchema } from "prisma/generated/zod";
import {
  NotificationDeleteInputsSchema,
  NotificationCreateInputsSchema,
  onCreateNotification,
  onDeleteNotification,
  NotificationUpdateInputsSchema,
  onNotificationUpdate,
  onFindNotification,
  NotificationFindInputsSchema,
  NotificationPageInputsSchema,
  onPageNotification,
  onSendNotification,
  NotificationSendInputsSchema,
  NotificationFindOutputSchema,
} from "./handler";
import { z } from "zod";

const PATH_PREFIX = "/notification";

export const TAG = "7000 - 推送";

export const NotitficationRouter = createTRPCRouter({
  createNotification: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/create-notification`,
        tags: [TAG],
        protect: true,
        summary: "创建推送",
      },
    })
    .input(NotificationCreateInputsSchema)
    .output(NotificationSchema)
    .mutation(onCreateNotification),
  deleteNotification: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/delete-notification/{id}`,
        tags: [TAG],
        protect: true,
        summary: "删除推送",
      },
    })
    .input(NotificationDeleteInputsSchema)
    .output(NotificationSchema.nullable())
    .mutation(onDeleteNotification),
  updateNotification: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/update-notification/{id}`,
        tags: [TAG],
        protect: true,
        summary: "更新推送",
      },
    })
    .input(NotificationUpdateInputsSchema)
    .output(NotificationSchema)
    .mutation(onNotificationUpdate),
  findNotification: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/find-notification/{id}`,
        tags: [TAG],
        protect: true,
        summary: "获取推送详情",
      },
    })
    .input(NotificationFindInputsSchema)
    .output(NotificationFindOutputSchema.nullable())
    .query(onFindNotification),
  pageNotification: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${PATH_PREFIX}/page-notification`,
        tags: [TAG],
        protect: true,
        summary: "分页查询推送列表",
      },
    })
    .input(NotificationPageInputsSchema)
    .output(asPagedResult(NotificationSchema))
    .query(onPageNotification),
  sendNotification: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: `${PATH_PREFIX}/send-notification/{id}`,
        tags: [TAG],
        protect: true,
        summary: "发送推送",
      },
    })
    .input(NotificationSendInputsSchema)
    .output(z.void())
    .mutation(onSendNotification),
});
