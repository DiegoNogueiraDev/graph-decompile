import { describe, it, expect } from "vitest";
import type { CanonicalFunction } from "@genai-decompiler/core-contracts";
import {
  validateEdgeConsistency,
  validateAddressFormat,
  validateBlockReachability,
} from "../structural-checks.js";

function makeFunction(overrides: Partial<CanonicalFunction> = {}): CanonicalFunction {
  return {
    id: "fn_001",
    binaryHash: "abc123",
    backendSources: ["ghidra"],
    arch: "x86_64",
    address: "0x401000",
    confidence: 0.8,
    blocks: [
      { id: "b0", address: "0x401000", instructions: [], confidence: 0.9 },
      { id: "b1", address: "0x401010", instructions: [], confidence: 0.9 },
    ],
    edges: [
      { from: "b0", to: "b1", type: "fallthrough", confidence: 0.9 },
    ],
    variables: [],
    calls: [],
    strings: [],
    imports: [],
    typeHints: [],
    semantics: { purpose: null, sideEffects: [], purity: "unknown" },
    diagnostics: [],
    ...overrides,
  };
}

describe("validateEdgeConsistency", () => {
  it("should pass when all edges reference existing blocks", () => {
    const fn = makeFunction();
    const result = validateEdgeConsistency(fn);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should fail when edge references non-existent source block", () => {
    const fn = makeFunction({
      edges: [{ from: "b_missing", to: "b1", type: "fallthrough", confidence: 0.9 }],
    });
    const result = validateEdgeConsistency(fn);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].code).toBe("EDGE_INVALID_SOURCE");
  });

  it("should fail when edge references non-existent target block", () => {
    const fn = makeFunction({
      edges: [{ from: "b0", to: "b_missing", type: "fallthrough", confidence: 0.9 }],
    });
    const result = validateEdgeConsistency(fn);
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe("EDGE_INVALID_TARGET");
  });

  it("should pass with empty edges and blocks", () => {
    const fn = makeFunction({ blocks: [], edges: [] });
    const result = validateEdgeConsistency(fn);
    expect(result.valid).toBe(true);
  });
});

describe("validateAddressFormat", () => {
  it("should pass when all addresses are valid hex", () => {
    const fn = makeFunction();
    const result = validateAddressFormat(fn);
    expect(result.valid).toBe(true);
  });

  it("should fail when function address is invalid", () => {
    const fn = makeFunction({ address: "not_hex" });
    const result = validateAddressFormat(fn);
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe("INVALID_ADDRESS");
  });

  it("should fail when block address is invalid", () => {
    const fn = makeFunction({
      blocks: [
        { id: "b0", address: "garbage", instructions: [], confidence: 0.9 },
      ],
    });
    const result = validateAddressFormat(fn);
    expect(result.valid).toBe(false);
    expect(result.errors[0].path).toContain("blocks");
  });
});

describe("validateBlockReachability", () => {
  it("should pass when all blocks are reachable from first block via edges", () => {
    const fn = makeFunction();
    const result = validateBlockReachability(fn);
    expect(result.valid).toBe(true);
  });

  it("should warn about unreachable blocks", () => {
    const fn = makeFunction({
      blocks: [
        { id: "b0", address: "0x401000", instructions: [], confidence: 0.9 },
        { id: "b1", address: "0x401010", instructions: [], confidence: 0.9 },
        { id: "b_orphan", address: "0x401020", instructions: [], confidence: 0.9 },
      ],
      edges: [
        { from: "b0", to: "b1", type: "fallthrough", confidence: 0.9 },
      ],
    });
    const result = validateBlockReachability(fn);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0].code).toBe("UNREACHABLE_BLOCK");
  });

  it("should pass with single block and no edges", () => {
    const fn = makeFunction({
      blocks: [{ id: "b0", address: "0x401000", instructions: [], confidence: 0.9 }],
      edges: [],
    });
    const result = validateBlockReachability(fn);
    expect(result.valid).toBe(true);
  });

  it("should pass with empty blocks", () => {
    const fn = makeFunction({ blocks: [], edges: [] });
    const result = validateBlockReachability(fn);
    expect(result.valid).toBe(true);
  });
});
