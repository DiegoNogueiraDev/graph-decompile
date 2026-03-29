import { describe, it, expect } from "vitest";
import {
  validateConfidenceThreshold,
  validateGenAiOutput,
  createHypothesisValidation,
} from "../genai-checks.js";
import { ExplainOutputSchema, RenameOutputSchema } from "@genai-decompiler/llm-adapter";

describe("validateConfidenceThreshold", () => {
  it("should accept when confidence >= default threshold (0.6)", () => {
    expect(validateConfidenceThreshold(0.7)).toBe(true);
    expect(validateConfidenceThreshold(0.6)).toBe(true);
    expect(validateConfidenceThreshold(1.0)).toBe(true);
  });

  it("should reject when confidence < default threshold (0.6)", () => {
    expect(validateConfidenceThreshold(0.5)).toBe(false);
    expect(validateConfidenceThreshold(0.0)).toBe(false);
  });

  it("should accept custom threshold", () => {
    expect(validateConfidenceThreshold(0.3, 0.2)).toBe(true);
    expect(validateConfidenceThreshold(0.1, 0.2)).toBe(false);
  });
});

describe("validateGenAiOutput", () => {
  it("should validate a correct ExplainOutput", () => {
    const data = {
      purpose: "Allocates memory for a buffer",
      sideEffects: ["heap allocation"],
      complexity: "low",
      confidence: 0.8,
    };
    const result = validateGenAiOutput(data, ExplainOutputSchema);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should reject an invalid ExplainOutput", () => {
    const data = {
      purpose: 123, // should be string
      sideEffects: "not an array",
    };
    const result = validateGenAiOutput(data, ExplainOutputSchema);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].code).toBe("SCHEMA_VALIDATION_FAILED");
  });

  it("should reject when confidence is out of range", () => {
    const data = {
      purpose: "Does something",
      sideEffects: [],
      complexity: "low",
      confidence: 1.5, // out of range
    };
    const result = validateGenAiOutput(data, ExplainOutputSchema);
    expect(result.valid).toBe(false);
  });

  it("should validate a correct RenameOutput", () => {
    const data = {
      suggestions: [
        { name: "allocateBuffer", confidence: 0.9, evidence: "calls malloc" },
      ],
    };
    const result = validateGenAiOutput(data, RenameOutputSchema);
    expect(result.valid).toBe(true);
  });
});

describe("createHypothesisValidation", () => {
  it("should accept hypothesis above threshold", () => {
    const result = createHypothesisValidation(0.8, "genai");
    expect(result.accepted).toBe(true);
    expect(result.confidence).toBe(0.8);
    expect(result.confidenceSource).toBe("genai");
    expect(result.rejectionReason).toBeUndefined();
  });

  it("should reject hypothesis below threshold with reason", () => {
    const result = createHypothesisValidation(0.3, "genai");
    expect(result.accepted).toBe(false);
    expect(result.confidence).toBe(0.3);
    expect(result.rejectionReason).toBeDefined();
    expect(result.rejectionReason).toContain("0.6");
  });

  it("should use custom threshold", () => {
    const result = createHypothesisValidation(0.4, "genai", 0.3);
    expect(result.accepted).toBe(true);
  });

  it("should always accept deterministic sources", () => {
    const result = createHypothesisValidation(0.2, "deterministic");
    expect(result.accepted).toBe(true);
    expect(result.confidenceSource).toBe("deterministic");
  });
});
