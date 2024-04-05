import { env } from "~/env.mjs";
import { Client } from "@googlemaps/google-maps-services-js";

const globalForPrisma = globalThis as unknown as {
  googleMapsClient: Client | undefined;
};

export const googleMapsClient =
  globalForPrisma.googleMapsClient ?? new Client({});

if (env.NODE_ENV !== "production")
  globalForPrisma.googleMapsClient = googleMapsClient;
