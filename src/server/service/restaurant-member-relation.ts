import { AppRouterContext } from "~/server/core/schema";

export type UpdateRestaurantMemberRelationOptions = {
  brandId: number;
  restaurantId: number;
  memberId: number;
  accessDate?: Date;
};

export const updateRestaurantMemberRelation = async (
  ctx: AppRouterContext,
  {
    brandId,
    restaurantId,
    memberId,
    accessDate,
  }: UpdateRestaurantMemberRelationOptions,
) => {
  const entity = await ctx.db.restaurantMemberRelation.upsert({
    create: {
      brandId,
      restaurantId,
      memberId,
      accessDate,
    },
    update: {
      updateAt: new Date(),
      accessDate: new Date(),
    },
    where: {
      restaurantId_memberId_deleteAt: {
        restaurantId,
        memberId,
        deleteAt: 0,
      },
    },
  });

  await ctx.db.restaurantMemberRelation.update({
    data: {
      accessTimes: {
        increment: 1,
      },
    },
    where: { id: entity.id },
  });
};
