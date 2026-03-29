import { describe, it, expect } from "vitest";
import {
  normalizeGhidra,
  normalizeAngr,
  computeConvergence,
} from "../normalizers.js";
import { CanonicalFunctionSchema } from "../canonical.js";
import type { GhidraExtractedData } from "@genai-decompiler/ghidra-adapter";
import type { AngrExtractedData } from "@genai-decompiler/angr-adapter";

const BINARY_HASH = "deadbeef123456";

const ghidraFixture: GhidraExtractedData = {
  status: "success",
  binary: { name: "test.bin", arch: "x86_64", format: "ELF" },
  functions: [
    { name: "main", address: "0x401000", size: 128 },
    { name: "FUN_00401100", address: "0x401100", size: 64 },
  ],
  strings: [{ address: "0x402000", value: "Hello World" }],
  imports: [{ name: "printf", library: "libc.so.6", address: "0x403000" }],
};

const angrFixture: AngrExtractedData = {
  status: "success",
  binary: { name: "test.bin", arch: "x86_64", format: "ELF" },
  functions: [
    {
      name: "main",
      address: "0x401000",
      blocks: [
        { address: "0x401000", size: 32, instructions: ["push rbp", "mov rbp, rsp"] },
        { address: "0x401020", size: 16, instructions: ["xor eax, eax", "ret"] },
      ],
      edges: [{ from: "0x401000", to: "0x401020", type: "fallthrough" }],
    },
  ],
  ail: { "0x401000": "v0 = stack_base - 0x8" },
};

describe("normalizeGhidra", () => {
  it("converts Ghidra output to CanonicalFunction array", () => {
    const result = normalizeGhidra(ghidraFixture, BINARY_HASH);
    expect(result).toHaveLength(2);
    expect(result[0].address).toBe("0x401000");
    expect(result[0].rawName).toBe("main");
    expect(result[0].binaryHash).toBe(BINARY_HASH);
    expect(result[0].backendSources).toContain("ghidra");
  });

  it("produces valid CanonicalFunction schemas", () => {
    const result = normalizeGhidra(ghidraFixture, BINARY_HASH);
    for (const fn of result) {
      const parsed = CanonicalFunctionSchema.safeParse(fn);
      expect(parsed.success).toBe(true);
    }
  });

  it("includes strings and imports from Ghidra data", () => {
    const result = normalizeGhidra(ghidraFixture, BINARY_HASH);
    expect(result[0].strings).toHaveLength(1);
    expect(result[0].strings[0].value).toBe("Hello World");
    expect(result[0].imports).toHaveLength(1);
    expect(result[0].imports[0].name).toBe("printf");
  });

  it("fills absent fields with defaults", () => {
    const result = normalizeGhidra(ghidraFixture, BINARY_HASH);
    expect(result[0].confidence).toBeGreaterThanOrEqual(0);
    expect(result[0].confidence).toBeLessThanOrEqual(1);
    expect(result[0].semantics).toBeDefined();
    expect(result[0].diagnostics).toEqual([]);
  });
});

describe("normalizeAngr", () => {
  it("converts angr output to CanonicalFunction array", () => {
    const result = normalizeAngr(angrFixture, BINARY_HASH);
    expect(result).toHaveLength(1);
    expect(result[0].address).toBe("0x401000");
    expect(result[0].backendSources).toContain("angr");
  });

  it("produces valid CanonicalFunction schemas", () => {
    const result = normalizeAngr(angrFixture, BINARY_HASH);
    for (const fn of result) {
      const parsed = CanonicalFunctionSchema.safeParse(fn);
      expect(parsed.success).toBe(true);
    }
  });

  it("includes blocks and edges from angr CFG", () => {
    const result = normalizeAngr(angrFixture, BINARY_HASH);
    expect(result[0].blocks).toHaveLength(2);
    expect(result[0].edges).toHaveLength(1);
    expect(result[0].edges[0].type).toBe("fallthrough");
  });

  it("fills absent fields with defaults", () => {
    const result = normalizeAngr(angrFixture, BINARY_HASH);
    expect(result[0].variables).toEqual([]);
    expect(result[0].calls).toEqual([]);
    expect(result[0].typeHints).toEqual([]);
  });
});

describe("computeConvergence", () => {
  it("returns convergence score 0-1 when both backends have data", () => {
    const ghidraFns = normalizeGhidra(ghidraFixture, BINARY_HASH);
    const angrFns = normalizeAngr(angrFixture, BINARY_HASH);
    const score = computeConvergence(ghidraFns, angrFns);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("returns 0 when one backend has no data", () => {
    const ghidraFns = normalizeGhidra(ghidraFixture, BINARY_HASH);
    const score = computeConvergence(ghidraFns, []);
    expect(score).toBe(0);
  });

  it("returns higher score when functions overlap by address", () => {
    const ghidraFns = normalizeGhidra(ghidraFixture, BINARY_HASH);
    const angrFns = normalizeAngr(angrFixture, BINARY_HASH);
    const score = computeConvergence(ghidraFns, angrFns);
    // main at 0x401000 exists in both → should be > 0
    expect(score).toBeGreaterThan(0);
  });
});
