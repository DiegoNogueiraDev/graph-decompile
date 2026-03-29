import { describe, it, expect, vi } from "vitest";
import {
  analyzeBinary,
  type AnalyzePipelineOptions,
  type AnalyzeResult,
} from "../pipeline.js";
import type { GhidraExtractedData } from "@genai-decompiler/ghidra-adapter";
import type { AngrExtractedData } from "@genai-decompiler/angr-adapter";

const ghidraFixture: GhidraExtractedData = {
  status: "success",
  binary: { name: "test.bin", arch: "x86_64", format: "ELF" },
  functions: [
    { name: "main", address: "0x401000", size: 128 },
  ],
  strings: [{ address: "0x402000", value: "hello" }],
  imports: [{ name: "printf", library: "libc.so.6", address: "0x403000" }],
};

const angrFixture: AngrExtractedData = {
  status: "success",
  binary: { name: "test.bin", arch: "x86_64", format: "ELF" },
  functions: [
    {
      name: "main",
      address: "0x401000",
      blocks: [{ address: "0x401000", size: 32, instructions: ["push rbp"] }],
      edges: [],
    },
  ],
};

describe("analyzeBinary pipeline", () => {
  const opts: AnalyzePipelineOptions = {
    binaryHash: "abc123",
    runGhidra: async () => ghidraFixture,
    runAngr: async () => angrFixture,
  };

  it("invokes both backends and returns normalized functions", async () => {
    const result = await analyzeBinary(opts);
    expect(result.ghidraFunctions.length).toBeGreaterThan(0);
    expect(result.angrFunctions.length).toBeGreaterThan(0);
  });

  it("computes convergence score", async () => {
    const result = await analyzeBinary(opts);
    expect(result.convergenceScore).toBeGreaterThanOrEqual(0);
    expect(result.convergenceScore).toBeLessThanOrEqual(1);
  });

  it("returns summary with function count", async () => {
    const result = await analyzeBinary(opts);
    expect(result.summary).toContain("1"); // at least 1 function
    expect(result.summary.toLowerCase()).toContain("function");
  });

  it("handles ghidra failure gracefully", async () => {
    const failOpts: AnalyzePipelineOptions = {
      binaryHash: "abc123",
      runGhidra: async () => ({ status: "error", error: "timeout", functions: [], strings: [], imports: [] }),
      runAngr: async () => angrFixture,
    };
    const result = await analyzeBinary(failOpts);
    expect(result.ghidraFunctions).toHaveLength(0);
    expect(result.angrFunctions.length).toBeGreaterThan(0);
  });

  it("handles angr failure gracefully", async () => {
    const failOpts: AnalyzePipelineOptions = {
      binaryHash: "abc123",
      runGhidra: async () => ghidraFixture,
      runAngr: async () => ({ status: "error", error: "crash", functions: [] }),
    };
    const result = await analyzeBinary(failOpts);
    expect(result.ghidraFunctions.length).toBeGreaterThan(0);
    expect(result.angrFunctions).toHaveLength(0);
  });
});
