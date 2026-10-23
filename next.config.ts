import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  // Confirmation URLs contain bearer secrets; omit them from dev request logs.
  logging: { serverFunctions: false, incomingRequests: { ignore: [/\/auth\/confirm(?:[/?]|$)/] } },
  /* config options here */
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
