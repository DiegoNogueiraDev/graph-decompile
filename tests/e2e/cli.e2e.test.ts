import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { existsSync, statSync } from "node:fs";
import {
  runDoctor,
  formatDoctorOutput,
  type DoctorResult,
} from "@genai-decompiler/cli";

const PROJECT_ROOT = join(import.meta.dirname, "..", "..");
const BIN_DIR = join(PROJECT_ROOT, "bin");
const SAMPLE_BINARY = join(BIN_DIR, "MEA");

describe("E2E: CLI doctor command", () => {
  let result: DoctorResult;

  it("runDoctor returns checks for all 5 dependencies", async () => {
    result = await runDoctor();

    expect(result.checks).toBeDefined();
    expect(result.checks.length).toBe(5);

    const names = result.checks.map((c) => c.name);
    expect(names).toContain("node");
    expect(names).toContain("java");
    expect(names).toContain("ghidra");
    expect(names).toContain("python");
    expect(names).toContain("angr");
  }, 30_000);

  it("each check has name, ok status, and version or error", async () => {
    result = await runDoctor();

    for (const check of result.checks) {
      expect(check.name).toBeTruthy();
      expect(typeof check.ok).toBe("boolean");

      if (!check.ok) {
        // Missing dependencies should have error message
        expect(check.error).toBeTruthy();
      }
    }
  }, 30_000);

  it("Node.js check passes (we are running in Node)", async () => {
    result = await runDoctor();
    const nodeCheck = result.checks.find((c) => c.name === "node");

    expect(nodeCheck).toBeDefined();
    expect(nodeCheck!.ok).toBe(true);
    expect(nodeCheck!.version).toBeTruthy();
  }, 30_000);

  it("formatDoctorOutput produces readable status lines", async () => {
    result = await runDoctor();
    const output = formatDoctorOutput(result.checks);

    expect(output).toContain("node:");
    expect(output).toContain("java:");
    expect(output).toContain("python:");
    expect(output).toContain("ghidra:");
    expect(output).toContain("angr:");

    // Each line should start with [OK] or [FAIL]
    const lines = output.split("\n");
    for (const line of lines) {
      expect(line).toMatch(/^\[(OK|FAIL)\]/);
    }
  }, 30_000);

  it("allOk reflects whether all checks passed", async () => {
    result = await runDoctor();
    const allPassed = result.checks.every((c) => c.ok);
    expect(result.allOk).toBe(allPassed);
  }, 30_000);
});

describe("E2E: CLI analyze command", () => {
  it("sample binary exists for analyze tests", () => {
    expect(existsSync(SAMPLE_BINARY)).toBe(true);
    expect(statSync(SAMPLE_BINARY).size).toBeGreaterThan(0);
  });

  it("hashBinary produces a SHA-256 hash for the sample binary", async () => {
    const { hashBinary } = await import("@genai-decompiler/storage");
    const hash = await hashBinary(SAMPLE_BINARY);

    expect(hash).toBeTruthy();
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("runAnalyzeCommand fails gracefully with invalid path", async () => {
    const { runAnalyzeCommand } = await import("@genai-decompiler/cli");
    const { tmpdir } = await import("node:os");

    await expect(
      runAnalyzeCommand({
        binaryPath: "/nonexistent/binary",
        workspaceBase: tmpdir(),
        runGhidra: async () => {
          throw new Error("binary not found");
        },
        runAngr: async () => {
          throw new Error("binary not found");
        },
      }),
    ).rejects.toThrow();
  });
});
