import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Next's standalone file tracing misses @prisma/adapter-better-sqlite3
  // even though src/lib/db.ts imports it directly -- it's forced in here so
  // it's actually present in the runtime image's node_modules, which both
  // the app itself and the prisma/*.ts scripts run via `tsx` depend on.
  outputFileTracingIncludes: {
    "/**": ["./node_modules/@prisma/adapter-better-sqlite3/**"],
  },
};

export default nextConfig;
