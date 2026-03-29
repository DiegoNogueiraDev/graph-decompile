import { describe, it, expect } from "vitest";
import {
  buildExplainPrompt,
  buildRenamePrompt,
  buildTypeInferencePrompt,
  buildDiffSummaryPrompt,
  ExplainOutputSchema,
  RenameOutputSchema,
  TypeInferenceOutputSchema,
  DiffSummaryOutputSchema,
} from "../prompts.js";
import type { CanonicalFunction } from "@genai-decompiler/core-contracts";

const mockFunction: Pick<CanonicalFunction, "id" | "address" | "rawName" | "arch" | "blocks" | "calls" | "strings" | "imports"> = {
  id: "fn_001",
  address: "0x401000",
  rawName: "FUN_00401000",
  arch: "x86_64",
  blocks: [{ id: "b1", address: "0x401000", instructions: [{ address: "0x401000", mnemonic: "push", operands: "rbp" }], confidence: 0.8 }],
  calls: [{ address: "0x401050", targetName: "printf", confidence: 0.9 }],
  strings: [{ address: "0x402000", value: "Error: %s", confidence: 0.9 }],
  imports: [{ name: "printf", library: "libc.so.6", confidence: 0.9 }],
};

describe("buildExplainPrompt", () => {
  it("returns a string containing function context", () => {
    const prompt = buildExplainPrompt(mockFunction);
    expect(prompt).toContain("0x401000");
    expect(prompt).toContain("FUN_00401000");
    expect(prompt).toContain("JSON");
  });

  it("output schema validates correct explain response", () => {
    const result = ExplainOutputSchema.safeParse({
      purpose: "Prints an error message to stdout",
      sideEffects: ["writes to stdout"],
      complexity: "low",
      confidence: 0.8,
    });
    expect(result.success).toBe(true);
  });
});

describe("buildRenamePrompt", () => {
  it("returns a string with function context and rename instruction", () => {
    const prompt = buildRenamePrompt(mockFunction);
    expect(prompt).toContain("FUN_00401000");
    expect(prompt).toContain("name");
  });

  it("output schema validates correct rename response", () => {
    const result = RenameOutputSchema.safeParse({
      suggestions: [
        { name: "printError", confidence: 0.85, evidence: "calls printf with Error: format string" },
        { name: "logError", confidence: 0.7, evidence: "error logging pattern" },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("buildTypeInferencePrompt", () => {
  it("returns a string with type inference context", () => {
    const prompt = buildTypeInferencePrompt(mockFunction);
    expect(prompt).toContain("type");
  });

  it("output schema validates correct type inference response", () => {
    const result = TypeInferenceOutputSchema.safeParse({
      inferences: [
        { targetId: "var_001", suggestedType: "const char*", confidence: 0.75, reasoning: "passed to printf" },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("buildDiffSummaryPrompt", () => {
  it("returns a string with diff context", () => {
    const prompt = buildDiffSummaryPrompt("fn_old_ir_json", "fn_new_ir_json");
    expect(prompt).toContain("fn_old_ir_json");
    expect(prompt).toContain("fn_new_ir_json");
  });

  it("output schema validates correct diff summary response", () => {
    const result = DiffSummaryOutputSchema.safeParse({
      summary: "Function was modified to add input validation",
      changes: ["added bounds check", "new error path"],
      severity: "medium",
      confidence: 0.8,
    });
    expect(result.success).toBe(true);
  });
});
