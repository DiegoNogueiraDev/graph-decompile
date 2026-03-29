import { describe, it, expect } from "vitest";
import {
  validateHypothesis,
  type Hypothesis,
  type ValidationResult,
  type ValidatorConfig,
} from "../hypothesis-validator.js";

const defaultConfig: ValidatorConfig = { minConfidence: 0.6 };

describe("validateHypothesis", () => {
  it("accepts hypothesis with confidence >= threshold", () => {
    const hyp: Hypothesis = {
      id: "hyp_001",
      type: "name_suggestion",
      value: "processInput",
      confidence: 0.85,
      source: "genai",
    };
    const result = validateHypothesis(hyp, defaultConfig);
    expect(result.accepted).toBe(true);
    expect(result.confidenceSource).toBe("genai");
  });

  it("rejects hypothesis with confidence < threshold", () => {
    const hyp: Hypothesis = {
      id: "hyp_002",
      type: "name_suggestion",
      value: "foo",
      confidence: 0.3,
      source: "genai",
    };
    const result = validateHypothesis(hyp, defaultConfig);
    expect(result.accepted).toBe(false);
    expect(result.rejectionReason).toBeDefined();
    expect(result.rejectionReason).toContain("confidence");
  });

  it("rejects hypothesis at exactly threshold boundary", () => {
    const hyp: Hypothesis = {
      id: "hyp_003",
      type: "type_inference",
      value: "int",
      confidence: 0.59,
      source: "genai",
    };
    const result = validateHypothesis(hyp, defaultConfig);
    expect(result.accepted).toBe(false);
  });

  it("accepts hypothesis at exactly threshold", () => {
    const hyp: Hypothesis = {
      id: "hyp_004",
      type: "type_inference",
      value: "uint32_t",
      confidence: 0.6,
      source: "genai",
    };
    const result = validateHypothesis(hyp, defaultConfig);
    expect(result.accepted).toBe(true);
  });

  it("allows custom minConfidence", () => {
    const hyp: Hypothesis = {
      id: "hyp_005",
      type: "name_suggestion",
      value: "bar",
      confidence: 0.8,
      source: "genai",
    };
    const strictConfig: ValidatorConfig = { minConfidence: 0.9 };
    const result = validateHypothesis(hyp, strictConfig);
    expect(result.accepted).toBe(false);
  });

  it("flags confidence_source as deterministic for non-genai sources", () => {
    const hyp: Hypothesis = {
      id: "hyp_006",
      type: "name_suggestion",
      value: "main",
      confidence: 0.95,
      source: "ghidra",
    };
    const result = validateHypothesis(hyp, defaultConfig);
    expect(result.accepted).toBe(true);
    expect(result.confidenceSource).toBe("deterministic");
  });

  it("records rejection with justification", () => {
    const hyp: Hypothesis = {
      id: "hyp_007",
      type: "explanation",
      value: "This function does stuff",
      confidence: 0.2,
      source: "genai",
    };
    const result = validateHypothesis(hyp, defaultConfig);
    expect(result.accepted).toBe(false);
    expect(result.rejectionReason).toBeDefined();
    expect(result.hypothesis).toBe(hyp);
  });
});
