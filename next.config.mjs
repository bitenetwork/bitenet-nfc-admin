/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
await import("./src/env.mjs");

/** @type {import("next").NextConfig} */
const config = {
  output: "standalone",
  assetPrefix: process.env.NODE_ENV === "production" ? "/api" : undefined,
  experimental: {
    instrumentationHook: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push("child_process");
    }
    return config;
  },
};

export default config;
