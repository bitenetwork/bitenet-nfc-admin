"use client";

import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
} from "@tanstack/react-query";
import { loggerLink, unstable_httpBatchStreamLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { useState } from "react";

import { type AppRouter } from "~/server/admin/root";
import { getUrl, transformer } from "./shared";
import { message } from "antd";
import { TRPCClientError } from "@trpc/client";
import { useRouter } from "next/router";

export const api = createTRPCReact<AppRouter>();

export function TRPCReactProvider(props: {
  children: React.ReactNode;
  cookies: string;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          mutations: {
            onError: async (error) => {
              if (error instanceof TRPCClientError) {
                message.error(error.message);
              }
              return error;
            },
          },
          queries: {
            refetchOnWindowFocus: false,
            onError: (error) => {
              if (error instanceof TRPCClientError) {
                message.error(error.message);
                if ("UNAUTHORIZED" === error.data.code) {
                  localStorage.removeItem("NFC_TOKEN");
                }
              }
            },
          },
        },
      }),
  );

  const [trpcClient] = useState(() =>
    api.createClient({
      transformer,
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === "development" ||
            (op.direction === "down" && op.result instanceof Error),
        }),
        unstable_httpBatchStreamLink({
          url: getUrl(),
          headers() {
            const token = localStorage.getItem("NFC_TOKEN");
            return {
              Authorization: `Bearer ${token}`,
              cookie: props.cookies,
              "x-trpc-source": "react",
            };
          },
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        {props.children}
      </api.Provider>
    </QueryClientProvider>
  );
}
