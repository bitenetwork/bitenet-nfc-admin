import { z } from "zod";
import _ from "lodash";
import { db } from "~/server/db";

export const cronSync = async function fetchAllUsers() {
  try {
    const brands = await db.brand.findMany({});

    for (const brand of brands) {
      if (!brand.expiredDate) {
        break;
      }

      if (brand.levelType === "EXPIRED") {
        break;
      }

      if (new Date() > brand.expiredDate) {
        await db.brand.update({
          where: { id: brand.id },
          data: { levelType: "EXPIRED" },
        });
      }
    }
  } catch (error) {
    console.error("Error processing brand level update", error);
  }
};
