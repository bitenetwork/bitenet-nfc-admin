import { generateOpenApiDocument } from "trpc-openapi";

import { appRouter, ALL_TAG } from "./root";
import { env } from "~/env.mjs";

// Generate OpenAPI schema document
export const openApiDocument = generateOpenApiDocument(appRouter, {
  title: "Restaurant REST API",
  description: "OpenAPI compliant REST API built using tRPC with Next.js",
  version: "1.0.0",
  baseUrl: `${env.BASE_URL}/api/restaurant`,
  docsUrl: "https://github.com/jlalmes/trpc-openapi",
  tags: ALL_TAG,
});
