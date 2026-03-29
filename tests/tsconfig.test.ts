import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(__dirname, "..");
const PACKAGES_DIR = join(ROOT, "packages");

const PACKAGES = [
  "cli",
  "mcp-server",
  "core-contracts",
  "orchestration",
  "storage",
  "validation",
  "llm-adapter",
  "ghidra-adapter",
  "angr-adapter",
  "reporting",
] as const;

function readJson(path: string) {
  // Strip JSON comments for tsconfig files
  const raw = readFileSync(path, "utf-8");
  const stripped = raw.replace(/\/\/.*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  return JSON.parse(stripped);
}

describe("tsconfig base", () => {
  it("tsconfig.base.json exists at root", () => {
    expect(existsSync(join(ROOT, "tsconfig.base.json"))).toBe(true);
  });

  it("has strict mode enabled", () => {
    const config = readJson(join(ROOT, "tsconfig.base.json"));
    expect(config.compilerOptions.strict).toBe(true);
  });

  it("targets modern ESM", () => {
    const config = readJson(join(ROOT, "tsconfig.base.json"));
    expect(config.compilerOptions.module).toMatch(/nodenext|esnext/i);
  });
});

describe("per-package tsconfig", () => {
  for (const pkg of PACKAGES) {
    it(`${pkg}/tsconfig.json extends base`, () => {
      const tsconfig = readJson(join(PACKAGES_DIR, pkg, "tsconfig.json"));
      expect(tsconfig.extends).toContain("tsconfig.base.json");
    });
  }
});
