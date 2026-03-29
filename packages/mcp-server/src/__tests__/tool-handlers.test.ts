import { describe, it, expect } from "vitest";
import {
  handleAnalyzeBinary,
  handleListFunctions,
  handleGetFunction,
  type ToolContext,
} from "../tool-handlers.js";
import type { CanonicalFunction } from "@genai-decompiler/core-contracts";

const mockFunction: CanonicalFunction = {
  id: "fn_001",
  binaryHash: "abc123",
  backendSources: ["ghidra"],
  arch: "x86_64",
  address: "0x401000",
  rawName: "main",
  confidence: 0.85,
  blocks: [],
  edges: [],
  variables: [],
  calls: [],
  strings: [],
  imports: [],
  typeHints: [],
  semantics: { purpose: null, sideEffects: [], purity: "unknown" },
  diagnostics: [],
};

const mockCtx: ToolContext = {
  analyzeBinary: async () => ({
    binaryHash: "abc123",
    workspacePath: "/tmp/ws/abc123",
    summary: "1 function(s) discovered",
    totalFunctions: 1,
  }),
  listFunctions: async () => [mockFunction],
  getFunction: async (id: string) => (id === "fn_001" ? mockFunction : null),
};

describe("handleAnalyzeBinary", () => {
  it("returns hash and summary", async () => {
    const result = await handleAnalyzeBinary({ binaryPath: "/tmp/test.bin" }, mockCtx);
    expect(result.binaryHash).toBe("abc123");
    expect(result.summary).toContain("function");
    expect(result.totalFunctions).toBe(1);
  });
});

describe("handleListFunctions", () => {
  it("returns array of functions", async () => {
    const result = await handleListFunctions({ binaryHash: "abc123" }, mockCtx);
    expect(result).toHaveLength(1);
    expect(result[0].address).toBe("0x401000");
  });
});

describe("handleGetFunction", () => {
  it("returns full IR for existing function", async () => {
    const result = await handleGetFunction({ functionId: "fn_001" }, mockCtx);
    expect(result).not.toBeNull();
    expect(result!.id).toBe("fn_001");
    expect(result!.arch).toBe("x86_64");
  });

  it("returns null for non-existing function", async () => {
    const result = await handleGetFunction({ functionId: "nonexistent" }, mockCtx);
    expect(result).toBeNull();
  });
});
