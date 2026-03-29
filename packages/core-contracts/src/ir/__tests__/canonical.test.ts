import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  CanonicalFunctionSchema,
  CanonicalBlockSchema,
  CanonicalEdgeSchema,
  CanonicalVariableSchema,
  CanonicalCallSiteSchema,
  CanonicalStringRefSchema,
  CanonicalImportRefSchema,
  CanonicalTypeHintSchema,
  CanonicalSemanticFactsSchema,
  CanonicalDiagnosticSchema,
} from "../canonical.js";

// Helper: confidence must be 0-1
const validConfidence = 0.85;
const invalidConfidence = 1.5;

function makeValidBlock(): z.input<typeof CanonicalBlockSchema> {
  return {
    id: "block_001",
    address: "0x401000",
    instructions: [
      { address: "0x401000", mnemonic: "push", operands: "rbp", raw: "55" },
    ],
    confidence: validConfidence,
  };
}

function makeValidEdge(): z.input<typeof CanonicalEdgeSchema> {
  return {
    from: "block_001",
    to: "block_002",
    type: "fallthrough",
    confidence: validConfidence,
  };
}

function makeValidVariable(): z.input<typeof CanonicalVariableSchema> {
  return {
    id: "var_001",
    name: "counter",
    type: "int32",
    scope: "local",
    confidence: validConfidence,
  };
}

function makeValidCallSite(): z.input<typeof CanonicalCallSiteSchema> {
  return {
    address: "0x401050",
    targetName: "printf",
    targetAddress: "0x402000",
    confidence: validConfidence,
  };
}

function makeValidFunction(): z.input<typeof CanonicalFunctionSchema> {
  return {
    id: "fn_001",
    binaryHash: "abc123def456",
    backendSources: ["ghidra"],
    arch: "x86_64",
    address: "0x401000",
    rawName: "FUN_00401000",
    confidence: validConfidence,
    blocks: [makeValidBlock()],
    edges: [makeValidEdge()],
    variables: [makeValidVariable()],
    calls: [makeValidCallSite()],
    strings: [{ address: "0x402100", value: "Hello", confidence: 0.9 }],
    imports: [
      { name: "printf", library: "libc.so.6", address: "0x402000", confidence: 0.95 },
    ],
    typeHints: [
      {
        targetId: "var_001",
        suggestedType: "uint32_t",
        source: "ghidra",
        confidence: 0.7,
      },
    ],
    semantics: {
      purpose: null,
      sideEffects: [],
      purity: "unknown",
    },
    diagnostics: [],
  };
}

describe("CanonicalBlock schema", () => {
  it("validates a correct block", () => {
    const result = CanonicalBlockSchema.safeParse(makeValidBlock());
    expect(result.success).toBe(true);
  });

  it("rejects block with confidence > 1", () => {
    const result = CanonicalBlockSchema.safeParse({
      ...makeValidBlock(),
      confidence: invalidConfidence,
    });
    expect(result.success).toBe(false);
  });

  it("rejects block without id", () => {
    const { id, ...rest } = makeValidBlock();
    const result = CanonicalBlockSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

describe("CanonicalEdge schema", () => {
  it("validates a correct edge", () => {
    const result = CanonicalEdgeSchema.safeParse(makeValidEdge());
    expect(result.success).toBe(true);
  });

  it("rejects edge with invalid type", () => {
    const result = CanonicalEdgeSchema.safeParse({
      ...makeValidEdge(),
      type: "invalid_type",
    });
    expect(result.success).toBe(false);
  });
});

describe("CanonicalVariable schema", () => {
  it("validates a correct variable", () => {
    const result = CanonicalVariableSchema.safeParse(makeValidVariable());
    expect(result.success).toBe(true);
  });

  it("rejects variable with confidence < 0", () => {
    const result = CanonicalVariableSchema.safeParse({
      ...makeValidVariable(),
      confidence: -0.1,
    });
    expect(result.success).toBe(false);
  });
});

describe("CanonicalFunction schema", () => {
  it("validates a complete valid function", () => {
    const result = CanonicalFunctionSchema.safeParse(makeValidFunction());
    expect(result.success).toBe(true);
  });

  it("contains all required fields: blocks, edges, variables, calls, strings, imports, typeHints", () => {
    const result = CanonicalFunctionSchema.safeParse(makeValidFunction());
    expect(result.success).toBe(true);
    if (result.success) {
      const fn = result.data;
      expect(fn.blocks).toBeDefined();
      expect(fn.edges).toBeDefined();
      expect(fn.variables).toBeDefined();
      expect(fn.calls).toBeDefined();
      expect(fn.strings).toBeDefined();
      expect(fn.imports).toBeDefined();
      expect(fn.typeHints).toBeDefined();
    }
  });

  it("has confidence field (0-1)", () => {
    const result = CanonicalFunctionSchema.safeParse(makeValidFunction());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.confidence).toBeGreaterThanOrEqual(0);
      expect(result.data.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("rejects function with invalid arch", () => {
    const result = CanonicalFunctionSchema.safeParse({
      ...makeValidFunction(),
      arch: "mips",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional fields as undefined", () => {
    const fn = makeValidFunction();
    delete (fn as any).rawName;
    delete (fn as any).normalizedName;
    delete (fn as any).pseudocode;
    const result = CanonicalFunctionSchema.safeParse(fn);
    expect(result.success).toBe(true);
  });

  it("rejects function without required binaryHash", () => {
    const { binaryHash, ...rest } = makeValidFunction();
    const result = CanonicalFunctionSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("validates runtime parse via zod.parse", () => {
    expect(() => CanonicalFunctionSchema.parse(makeValidFunction())).not.toThrow();
  });

  it("throws on invalid data via zod.parse", () => {
    expect(() => CanonicalFunctionSchema.parse({ invalid: true })).toThrow();
  });
});
