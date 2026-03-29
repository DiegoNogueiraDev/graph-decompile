import { describe, it, expect } from "vitest";
import {
  generateBinaryReport,
  generateFunctionReport,
  type BinaryReportInput,
  type FunctionReportInput,
} from "../reports.js";
import type { CanonicalFunction } from "@genai-decompiler/core-contracts";

const mockFn: CanonicalFunction = {
  id: "fn_001",
  binaryHash: "abc123",
  backendSources: ["ghidra", "angr"],
  arch: "x86_64",
  address: "0x401000",
  rawName: "main",
  confidence: 0.85,
  blocks: [{ id: "b0", address: "0x401000", instructions: [], confidence: 0.8 }],
  edges: [],
  variables: [],
  calls: [{ address: "0x401050", targetName: "printf", confidence: 0.9 }],
  strings: [{ address: "0x402000", value: "Hello", confidence: 0.9 }],
  imports: [{ name: "printf", library: "libc.so.6", confidence: 0.95 }],
  typeHints: [],
  semantics: { purpose: "Entry point", sideEffects: ["stdout"], purity: "impure" },
  diagnostics: [],
};

describe("generateBinaryReport", () => {
  const input: BinaryReportInput = {
    binaryHash: "abc123def456",
    binaryName: "test.bin",
    arch: "x86_64",
    functions: [mockFn],
    convergenceScore: 0.75,
  };

  it("generates markdown with binary metadata", () => {
    const report = generateBinaryReport(input, "markdown");
    expect(report).toContain("test.bin");
    expect(report).toContain("abc123def456");
    expect(report).toContain("x86_64");
  });

  it("includes function count and top functions", () => {
    const report = generateBinaryReport(input, "markdown");
    expect(report).toContain("main");
    expect(report).toContain("0x401000");
  });

  it("includes imports", () => {
    const report = generateBinaryReport(input, "markdown");
    expect(report).toContain("printf");
  });

  it("generates valid JSON", () => {
    const report = generateBinaryReport(input, "json");
    const parsed = JSON.parse(report);
    expect(parsed.binaryHash).toBe("abc123def456");
    expect(parsed.functions).toHaveLength(1);
  });
});

describe("generateFunctionReport", () => {
  const input: FunctionReportInput = {
    fn: mockFn,
    pseudocode: "int main() { printf(\"Hello\"); return 0; }",
    hypotheses: [
      { id: "h1", type: "name", value: "main", confidence: 0.95, accepted: true },
    ],
  };

  it("generates markdown with function details", () => {
    const report = generateFunctionReport(input, "markdown");
    expect(report).toContain("main");
    expect(report).toContain("0x401000");
    expect(report).toContain("pseudocode");
  });

  it("includes hypotheses with scores", () => {
    const report = generateFunctionReport(input, "markdown");
    expect(report).toContain("0.95");
  });

  it("generates valid JSON", () => {
    const report = generateFunctionReport(input, "json");
    const parsed = JSON.parse(report);
    expect(parsed.function.id).toBe("fn_001");
    expect(parsed.hypotheses).toHaveLength(1);
  });
});
