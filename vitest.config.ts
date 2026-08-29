import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirror the NodeNext ".js" specifiers used in the workspace packages.
    extensionAlias: {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    },
  },
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    environment: "node",
    server: {
      deps: { external: ["better-sqlite3"] },
    },
  },
});
