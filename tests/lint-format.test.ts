import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");

describe("ESLint configuration", () => {
  it("eslint.config.mjs exists", () => {
    expect(existsSync(resolve(ROOT, "eslint.config.mjs"))).toBe(true);
  });
});

describe("Prettier configuration", () => {
  it(".prettierrc exists", () => {
    expect(existsSync(resolve(ROOT, ".prettierrc"))).toBe(true);
  });

  it("has consistent format settings", () => {
    const config = JSON.parse(readFileSync(resolve(ROOT, ".prettierrc"), "utf-8"));
    expect(config.semi).toBeDefined();
    expect(config.printWidth).toBeDefined();
  });
});

describe("package.json scripts", () => {
  it("has lint script", () => {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8"));
    expect(pkg.scripts?.lint).toBeDefined();
  });

  it("has format script", () => {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8"));
    expect(pkg.scripts?.format).toBeDefined();
  });
});
