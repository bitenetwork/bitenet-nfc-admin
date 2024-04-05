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
} from "~/server/restaurant/routers/notification/handler";
import { z } from "zod";
import { OperatorType } from "@prisma/client";

export const NotitficationRouter = createTRPCRouter({
  createNotification: protectedProcedure
    .input(NotificationCreateInputsSchema)
    .output(NotificationSchema)
    .mutation(({ ctx, input }) =>
      onCreateNotification({ ctx, input, operator: OperatorType.ADMIN }),
    ),
  deleteNotification: protectedProcedure
    .input(NotificationDeleteInputsSchema)
    .output(NotificationSchema.nullable())
    .mutation(onDeleteNotification),
  updateNotification: protectedProcedure
    .input(NotificationUpdateInputsSchema)
    .output(NotificationSchema)
    .mutation(onNotificationUpdate),
  findNotification: protectedProcedure
    .input(NotificationFindInputsSchema)
    .output(NotificationFindOutputSchema.nullable())
    .query(onFindNotification),
  pageNotification: protectedProcedure
    .input(NotificationPageInputsSchema)
    .output(asPagedResult(NotificationSchema))
    .query(({ ctx, input }) =>
      onPageNotification({ ctx, input, operator: OperatorType.ADMIN }),
    ),
  sendNotification: protectedProcedure
    .input(NotificationSendInputsSchema)
    .output(z.void())
    .mutation(onSendNotification),
});
