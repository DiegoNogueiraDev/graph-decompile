import { defineConfig } from "tsup";

const shared = {
  format: ["esm"] as ["esm"],
  target: "node20" as const,
  platform: "node" as const,
  sourcemap: true,
  clean: true,
  external: [
    "better-sqlite3",
    "@modelcontextprotocol/sdk",
    "@modelcontextprotocol/sdk/server/mcp.js",
    "@modelcontextprotocol/sdk/server/stdio.js",
    "zod",
  ],
  noExternal: [/@genai-decompiler\/.*/],
};

export default defineConfig([
  {
    ...shared,
    entry: { stdio: "src/stdio.ts" },
    banner: { js: "#!/usr/bin/env node" },
    dts: false,
  },
  {
    ...shared,
    entry: { index: "src/index.ts" },
    dts: true,
    clean: false,
  },
]);
