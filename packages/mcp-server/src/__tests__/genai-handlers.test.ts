import { describe, it, expect } from "vitest";
import {
  handleExplainFunction,
  handleDecompileFunction,
  type GenAiToolContext,
  type ExplainResult,
  type DecompileResult,
} from "../genai-handlers.js";

const mockGenAiCtx: GenAiToolContext = {
  explainFunction: async () => ({
    purpose: "Allocates a memory buffer and initializes it",
    sideEffects: ["heap allocation"],
    complexity: "low" as const,
    confidence: 0.85,
    confidenceSource: "genai" as const,
  }),
  decompileFunction: async () => ({
    pseudocode: "void* allocateBuffer(size_t size) {\n  void* buf = malloc(size);\n  memset(buf, 0, size);\n  return buf;\n}",
    confidence: 0.75,
    confidenceSource: "genai" as const,
  }),
};

describe("handleExplainFunction", () => {
  it("returns explanation with confidence score", async () => {
    const result = await handleExplainFunction({ functionId: "fn_001" }, mockGenAiCtx);
    expect(result.purpose).toBeDefined();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.confidenceSource).toBe("genai");
  });

  it("includes side effects", async () => {
    const result = await handleExplainFunction({ functionId: "fn_001" }, mockGenAiCtx);
    expect(result.sideEffects).toContain("heap allocation");
  });
});

describe("handleDecompileFunction", () => {
  it("returns pseudocode with confidence", async () => {
    const result = await handleDecompileFunction({ functionId: "fn_001" }, mockGenAiCtx);
    expect(result.pseudocode).toContain("allocateBuffer");
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidenceSource).toBe("genai");
  });
});
