import _ from "lodash";
import { createTRPCRouter, protectedProcedure } from "~/server/admin/trpc";
import {
  PageMemberInputsSchema,
  PageRestaurantLatentMemberInputsSchema,
  QueryResultSchema,
  RestaurantLatentMemberOutPutScheam,
  onPageMember,
  onPageRestaurantLatentMember,
} from "~/server/restaurant/routers/restaurant-member";
import { asPagedResult } from "~/server/core/schema";

export const restaurantMemberRouter = createTRPCRouter({
  pageMember: protectedProcedure
    .input(PageMemberInputsSchema)
    .output(asPagedResult(QueryResultSchema))
    .query(onPageMember),
  pageRestaurantLatentMember: protectedProcedure
    .input(PageRestaurantLatentMemberInputsSchema)
    .output(asPagedResult(RestaurantLatentMemberOutPutScheam))
    .query(onPageRestaurantLatentMember),
});
