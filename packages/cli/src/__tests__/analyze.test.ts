import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  runAnalyzeCommand,
  type AnalyzeCommandOptions,
  type AnalyzeCommandResult,
} from "../analyze.js";
import type { GhidraExtractedData } from "@genai-decompiler/ghidra-adapter";
import type { AngrExtractedData } from "@genai-decompiler/angr-adapter";

const ghidraFixture: GhidraExtractedData = {
  status: "success",
  binary: { name: "test.bin", arch: "x86_64", format: "ELF" },
  functions: [{ name: "main", address: "0x401000", size: 128 }],
  strings: [],
  imports: [],
};

const angrFixture: AngrExtractedData = {
  status: "success",
  binary: { name: "test.bin", arch: "x86_64", format: "ELF" },
  functions: [
    { name: "main", address: "0x401000", blocks: [], edges: [] },
  ],
};

describe("runAnalyzeCommand", () => {
  let tempDir: string;
  let binPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "analyze-test-"));
    binPath = join(tempDir, "test.bin");
    writeFileSync(binPath, Buffer.from("fake ELF binary content"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  const opts = (): AnalyzeCommandOptions => ({
    binaryPath: binPath,
    workspaceBase: tempDir,
    runGhidra: async () => ghidraFixture,
    runAngr: async () => angrFixture,
  });

  it("accepts binary path and returns result", async () => {
    const result = await runAnalyzeCommand(opts());
    expect(result.binaryHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("creates workspace directory by hash", async () => {
    const result = await runAnalyzeCommand(opts());
    expect(result.workspacePath).toContain(result.binaryHash);
  });

  it("returns analysis summary with function count", async () => {
    const result = await runAnalyzeCommand(opts());
    expect(result.summary).toContain("function");
  });

  it("returns normalized functions from both backends", async () => {
    const result = await runAnalyzeCommand(opts());
    expect(result.totalFunctions).toBeGreaterThan(0);
  });
});

import { beforeEach, afterEach } from "vitest";
