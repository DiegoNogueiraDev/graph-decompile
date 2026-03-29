import { describe, it, expect } from "vitest";
import { CanonicalFunctionSchema } from "../canonical.js";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../../../..");

describe("IR v0 — common fields only", () => {
  it("CanonicalFunction accepts optional backendMetadata", () => {
    const fn = {
      id: "fn_001",
      binaryHash: "abc123",
      backendSources: ["ghidra"],
      arch: "x86_64" as const,
      address: "0x401000",
      confidence: 0.6,
      blocks: [],
      edges: [],
      variables: [],
      calls: [],
      strings: [],
      imports: [],
      typeHints: [],
      semantics: { purpose: null, sideEffects: [], purity: "unknown" as const },
      diagnostics: [],
      backendMetadata: {
        ghidra: { decompilerVersion: "11.0", analysisTime: 5.2 },
      },
    };
    const result = CanonicalFunctionSchema.safeParse(fn);
    expect(result.success).toBe(true);
  });

  it("CanonicalFunction works without backendMetadata", () => {
    const fn = {
      id: "fn_002",
      binaryHash: "abc123",
      backendSources: ["angr"],
      arch: "x86_64" as const,
      address: "0x401000",
      confidence: 0.6,
      blocks: [],
      edges: [],
      variables: [],
      calls: [],
      strings: [],
      imports: [],
      typeHints: [],
      semantics: { purpose: null, sideEffects: [], purity: "unknown" as const },
      diagnostics: [],
    };
    const result = CanonicalFunctionSchema.safeParse(fn);
    expect(result.success).toBe(true);
  });
});

describe("Ghidra-angr mapping doc", () => {
  it("docs/ir-mapping.md exists", () => {
    expect(existsSync(resolve(ROOT, "docs", "ir-mapping.md"))).toBe(true);
  });
});
