import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(__dirname, "..");
const PACKAGES_DIR = join(ROOT, "packages");

const EXPECTED_PACKAGES = [
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

const SCOPE = "@genai-decompiler";

describe("workspace configuration", () => {
  it("root package.json declares npm workspaces", () => {
    const rootPkg = JSON.parse(
      readFileSync(join(ROOT, "package.json"), "utf-8"),
    );
    expect(rootPkg.workspaces).toBeDefined();
    expect(rootPkg.workspaces).toContain("packages/*");
  });

  it("root package.json is private", () => {
    const rootPkg = JSON.parse(
      readFileSync(join(ROOT, "package.json"), "utf-8"),
    );
    expect(rootPkg.private).toBe(true);
  });

  for (const pkg of EXPECTED_PACKAGES) {
    describe(`${SCOPE}/${pkg}`, () => {
      const pkgDir = join(PACKAGES_DIR, pkg);

      it("has package.json", () => {
        expect(existsSync(join(pkgDir, "package.json"))).toBe(true);
      });

      it("has correct scoped name", () => {
        const pkgJson = JSON.parse(
          readFileSync(join(pkgDir, "package.json"), "utf-8"),
        );
        expect(pkgJson.name).toBe(`${SCOPE}/${pkg}`);
      });

      it("has src/index.ts entry point", () => {
        expect(existsSync(join(pkgDir, "src", "index.ts"))).toBe(true);
      });
    });
  }

  it("all packages can be cross-referenced via workspace protocol", () => {
    const cliPkg = JSON.parse(
      readFileSync(join(PACKAGES_DIR, "cli", "package.json"), "utf-8"),
    );
    expect(cliPkg.dependencies).toHaveProperty(
      `${SCOPE}/core-contracts`,
      "*",
    );
  });

  it("mcp-server depends on core-contracts and orchestration", () => {
    const mcpPkg = JSON.parse(
      readFileSync(join(PACKAGES_DIR, "mcp-server", "package.json"), "utf-8"),
    );
    expect(mcpPkg.dependencies).toHaveProperty(
      `${SCOPE}/core-contracts`,
      "*",
    );
    expect(mcpPkg.dependencies).toHaveProperty(
      `${SCOPE}/orchestration`,
      "*",
    );
  });
});
