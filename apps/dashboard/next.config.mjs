import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

// Next only auto-loads .env from this app's folder. In this monorepo the real
// .env lives at the repo root (shared with the bot), so load it here — before
// Next reads process.env or runs instrumentation.
const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, "../../.env") });
loadEnv({ path: resolve(here, ".env") }); // optional local override

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Linting runs as its own step (`npm run lint`) with the repo-root config.
  eslint: { ignoreDuringBuilds: true },
  // Internal TS workspace packages are consumed as source.
  transpilePackages: ["@ticketbot/db", "@ticketbot/shared"],
  experimental: {
    // better-sqlite3 is a native module; keep it out of the server bundle.
    serverComponentsExternalPackages: ["better-sqlite3"],
    // allow importing files from outside apps/dashboard (workspace packages)
    externalDir: true,
    // run instrumentation.ts on server startup (env validation)
    instrumentationHook: true,
  },
  webpack: (config) => {
    // The shared packages use NodeNext-style ".js" specifiers that point at ".ts"
    // sources. Teach webpack to resolve them.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
