import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIST_DIR = join(import.meta.dirname, "../../packages/mcp-server/dist");
const PKG_JSON = join(import.meta.dirname, "../../packages/mcp-server/package.json");

describe("npm package build output", () => {
  it("dist/stdio.js exists", () => {
    expect(existsSync(join(DIST_DIR, "stdio.js"))).toBe(true);
  });

  it("dist/stdio.js starts with shebang", () => {
    const content = readFileSync(join(DIST_DIR, "stdio.js"), "utf-8");
    expect(content.startsWith("#!/usr/bin/env node")).toBe(true);
  });

  it("dist/index.js exists", () => {
    expect(existsSync(join(DIST_DIR, "index.js"))).toBe(true);
  });

  it("dist/index.d.ts exists", () => {
    expect(existsSync(join(DIST_DIR, "index.d.ts"))).toBe(true);
  });

  it("index.js exports createDecompilerServer", () => {
    const content = readFileSync(join(DIST_DIR, "index.js"), "utf-8");
    expect(content).toContain("createDecompilerServer");
  });

  it("better-sqlite3 is external (not inlined)", () => {
    const content = readFileSync(join(DIST_DIR, "stdio.js"), "utf-8");
    // External deps appear as import statements, not inlined code
    expect(content).toContain("better-sqlite3");
    // Should NOT contain the actual sqlite C++ binding code
    expect(content).not.toContain("napi_create_external");
  });

  it("@genai-decompiler/* packages are inlined (not external)", () => {
    const content = readFileSync(join(DIST_DIR, "stdio.js"), "utf-8");
    expect(content).not.toContain("@genai-decompiler/");
  });

  it("package.json bin field points to existing file", () => {
    const pkg = JSON.parse(readFileSync(PKG_JSON, "utf-8"));
    const binPath = pkg.bin["genai-decompiler"];
    const resolved = join(import.meta.dirname, "../../packages/mcp-server", binPath);
    expect(existsSync(resolved)).toBe(true);
  });

  it("package.json has required publish fields", () => {
    const pkg = JSON.parse(readFileSync(PKG_JSON, "utf-8"));
    expect(pkg.private).toBeUndefined();
    expect(pkg.version).toBe("0.1.0");
    expect(pkg.type).toBe("module");
    expect(pkg.engines?.node).toBeDefined();
    expect(pkg.publishConfig?.access).toBe("public");
    expect(pkg.files).toContain("dist");
    expect(pkg.license).toBe("MIT");
  });
});
