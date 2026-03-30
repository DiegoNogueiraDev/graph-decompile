import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createDatabase,
  runMigrations,
  hashBinary,
  createWorkspaceWithArtifacts,
  type Database,
} from "@genai-decompiler/storage";
import { analyzeBinary } from "@genai-decompiler/orchestration";
import { CanonicalFunctionSchema } from "@genai-decompiler/core-contracts";
import type { GhidraExtractedData } from "@genai-decompiler/ghidra-adapter";
import type { AngrExtractedData } from "@genai-decompiler/angr-adapter";

// ── Realistic fixtures ──────────────────────────────────────────────────────

const ghidraFixture: GhidraExtractedData = {
  status: "success",
  binary: { name: "sample.elf", arch: "x86_64", format: "ELF" },
  functions: [
    { name: "main", address: "0x401000", size: 256 },
    { name: "FUN_00402000", address: "0x402000", size: 128 },
    { name: "FUN_00403000", address: "0x403000", size: 64 },
  ],
  strings: [
    { address: "0x404000", value: "Usage: %s <input>" },
    { address: "0x404020", value: "Error: invalid input" },
  ],
  imports: [
    { name: "printf", library: "libc.so.6", address: "0x405000" },
    { name: "malloc", library: "libc.so.6", address: "0x405010" },
    { name: "free", library: "libc.so.6", address: "0x405020" },
  ],
};

const angrFixture: AngrExtractedData = {
  status: "success",
  binary: { name: "sample.elf", arch: "x86_64", format: "ELF" },
  functions: [
    {
      name: "main",
      address: "0x401000",
      blocks: [
        { address: "0x401000", size: 32, instructions: ["push rbp", "mov rbp, rsp", "sub rsp, 0x20"] },
        { address: "0x401020", size: 16, instructions: ["call printf", "test eax, eax"] },
        { address: "0x401030", size: 8, instructions: ["leave", "ret"] },
      ],
      edges: [
        { from: "0x401000", to: "0x401020", type: "fallthrough" },
        { from: "0x401020", to: "0x401030", type: "conditional_true" },
      ],
    },
    {
      name: "sub_402000",
      address: "0x402000",
      blocks: [
        { address: "0x402000", size: 16, instructions: ["push rbp", "mov rbp, rsp"] },
      ],
      edges: [],
    },
    {
      name: "sub_404000",
      address: "0x404000",
      blocks: [
        { address: "0x404000", size: 8, instructions: ["xor eax, eax", "ret"] },
      ],
      edges: [],
    },
  ],
};

// ── Test state ──────────────────────────────────────────────────────────────

let tempDir: string;
let db: Database;
let binPath: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "pipeline-int-"));
  binPath = join(tempDir, "sample.elf");
  writeFileSync(binPath, Buffer.from("fake ELF binary content for integration test"));
  db = createDatabase(join(tempDir, "test.db"));
  runMigrations(db);
});

afterEach(() => {
  db.close();
  rmSync(tempDir, { recursive: true, force: true });
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe("Pipeline analyze end-to-end integration", () => {
  it("hashes binary, creates workspace, runs pipeline, and persists to SQLite", async () => {
    // Step 1: Hash binary
    const binaryHash = await hashBinary(binPath);
    expect(binaryHash).toMatch(/^[a-f0-9]{64}$/);

    // Step 2: Create workspace with artifact dirs
    const workspacePath = createWorkspaceWithArtifacts(tempDir, binaryHash);
    expect(workspacePath).toContain(binaryHash);

    // Step 3: Run pipeline
    const result = await analyzeBinary({
      binaryHash,
      runGhidra: async () => ghidraFixture,
      runAngr: async () => angrFixture,
    });

    expect(result.ghidraFunctions.length).toBe(3);
    expect(result.angrFunctions.length).toBe(3);
    expect(result.convergenceScore).toBeGreaterThan(0);
    expect(result.summary).toContain("function");

    // Step 4: Persist binary to SQLite
    db.prepare(
      "INSERT INTO binaries (hash, name, arch, size_bytes, imported_at) VALUES (?, ?, ?, ?, ?)",
    ).run(binaryHash, "sample.elf", "x86_64", 5632000, new Date().toISOString());

    // Step 5: Persist all canonical functions with IR JSON
    const insertFn = db.prepare(
      "INSERT INTO functions (id, binary_hash, address, raw_name, confidence, ir_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );

    const now = new Date().toISOString();
    const allFunctions = [...result.ghidraFunctions, ...result.angrFunctions];
    for (const fn of allFunctions) {
      insertFn.run(fn.id, binaryHash, fn.address, fn.rawName ?? null, fn.confidence, JSON.stringify(fn), now, now);
    }

    // Step 6: Persist artifact metadata
    db.prepare(
      "INSERT INTO artifacts (id, binary_hash, type, path, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("art_ghidra", binaryHash, "ghidra_json", join(workspacePath, "ghidra", "output.json"),
      JSON.stringify({ functionsCount: result.ghidraFunctions.length, convergence: result.convergenceScore }), now);

    // Step 7: Verify persistence
    const storedBinary = db.prepare("SELECT * FROM binaries WHERE hash = ?").get(binaryHash) as any;
    expect(storedBinary).toBeDefined();
    expect(storedBinary.name).toBe("sample.elf");

    const storedFunctions = db.prepare("SELECT * FROM functions WHERE binary_hash = ?").all(binaryHash) as any[];
    expect(storedFunctions.length).toBe(allFunctions.length);

    // Step 8: Verify each stored function has valid IR JSON
    for (const row of storedFunctions) {
      const ir = JSON.parse(row.ir_json);
      const validation = CanonicalFunctionSchema.safeParse(ir);
      expect(validation.success).toBe(true);
      expect(ir.binaryHash).toBe(binaryHash);
    }

    // Step 9: Verify artifact
    const storedArt = db.prepare("SELECT * FROM artifacts WHERE binary_hash = ?").all(binaryHash) as any[];
    expect(storedArt).toHaveLength(1);
    const artMeta = JSON.parse(storedArt[0].metadata_json);
    expect(artMeta.functionsCount).toBe(3);
  });

  it("handles partial backend failure — persists only successful results", async () => {
    const binaryHash = await hashBinary(binPath);

    // Ghidra fails, angr succeeds
    const result = await analyzeBinary({
      binaryHash,
      runGhidra: async () => ({ status: "error", error: "timeout", functions: [], strings: [], imports: [] }),
      runAngr: async () => angrFixture,
    });

    expect(result.ghidraFunctions).toHaveLength(0);
    expect(result.angrFunctions.length).toBeGreaterThan(0);
    expect(result.convergenceScore).toBe(0); // No convergence with one backend

    // Persist only available data
    db.prepare(
      "INSERT INTO binaries (hash, name, arch, size_bytes, imported_at) VALUES (?, ?, ?, ?, ?)",
    ).run(binaryHash, "sample.elf", "x86_64", 5632000, new Date().toISOString());

    const now = new Date().toISOString();
    for (const fn of result.angrFunctions) {
      db.prepare(
        "INSERT INTO functions (id, binary_hash, address, raw_name, confidence, ir_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ).run(fn.id, binaryHash, fn.address, fn.rawName ?? null, fn.confidence, JSON.stringify(fn), now, now);
    }

    const storedFunctions = db.prepare("SELECT * FROM functions WHERE binary_hash = ?").all(binaryHash) as any[];
    expect(storedFunctions.length).toBe(result.angrFunctions.length);

    // All stored functions should be from angr
    for (const row of storedFunctions) {
      const ir = JSON.parse(row.ir_json);
      expect(ir.backendSources).toContain("angr");
    }
  });

  it("validates convergence score with overlapping function addresses", async () => {
    const binaryHash = await hashBinary(binPath);

    const result = await analyzeBinary({
      binaryHash,
      runGhidra: async () => ghidraFixture,
      runAngr: async () => angrFixture,
    });

    // Both have 0x401000 (main) and 0x402000 — 2 overlap
    // Ghidra: 0x401000, 0x402000, 0x403000
    // angr: 0x401000, 0x402000, 0x404000
    // Union: 4, Overlap: 2, Score: 0.5
    expect(result.convergenceScore).toBe(0.5);
  });

  it("persists hypotheses linked to stored functions", async () => {
    const binaryHash = await hashBinary(binPath);

    const result = await analyzeBinary({
      binaryHash,
      runGhidra: async () => ghidraFixture,
      runAngr: async () => angrFixture,
    });

    // Persist binary + functions
    db.prepare(
      "INSERT INTO binaries (hash, name, arch, size_bytes, imported_at) VALUES (?, ?, ?, ?, ?)",
    ).run(binaryHash, "sample.elf", "x86_64", 5632000, new Date().toISOString());

    const now = new Date().toISOString();
    const mainFn = result.ghidraFunctions.find((f) => f.rawName === "main")!;
    db.prepare(
      "INSERT INTO functions (id, binary_hash, address, raw_name, confidence, ir_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(mainFn.id, binaryHash, mainFn.address, mainFn.rawName!, mainFn.confidence, JSON.stringify(mainFn), now, now);

    // Simulate GenAI hypothesis
    db.prepare(
      "INSERT INTO hypotheses (id, function_id, type, value, confidence, source, accepted, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run("hyp_rename", mainFn.id, "name_suggestion", "parseArguments", 0.78, "genai", 0, now);

    // Query chain: binary → function → hypothesis
    const fn = db.prepare("SELECT * FROM functions WHERE binary_hash = ? AND raw_name = ?").get(binaryHash, "main") as any;
    const hyps = db.prepare("SELECT * FROM hypotheses WHERE function_id = ?").all(fn.id) as any[];
    expect(hyps).toHaveLength(1);
    expect(hyps[0].value).toBe("parseArguments");
    expect(hyps[0].source).toBe("genai");
  });

  it("stores angr functions with block and edge detail in IR", async () => {
    const binaryHash = await hashBinary(binPath);

    const result = await analyzeBinary({
      binaryHash,
      runGhidra: async () => ghidraFixture,
      runAngr: async () => angrFixture,
    });

    // angr main should have blocks and edges
    const angrMain = result.angrFunctions.find((f) => f.address === "0x401000")!;
    expect(angrMain.blocks.length).toBeGreaterThan(0);
    expect(angrMain.edges.length).toBeGreaterThan(0);
    expect(angrMain.blocks[0].instructions.length).toBeGreaterThan(0);

    // Persist and verify round-trip
    db.prepare(
      "INSERT INTO binaries (hash, name, arch, size_bytes, imported_at) VALUES (?, ?, ?, ?, ?)",
    ).run(binaryHash, "sample.elf", "x86_64", 5632000, new Date().toISOString());

    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO functions (id, binary_hash, address, raw_name, confidence, ir_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(angrMain.id, binaryHash, angrMain.address, angrMain.rawName!, angrMain.confidence, JSON.stringify(angrMain), now, now);

    const row = db.prepare("SELECT ir_json FROM functions WHERE id = ?").get(angrMain.id) as any;
    const ir = JSON.parse(row.ir_json);

    // Validate blocks have instruction detail
    expect(ir.blocks[0].instructions[0].mnemonic).toBe("push");
    expect(ir.edges[0].type).toBe("fallthrough");

    // Full Zod validation
    expect(CanonicalFunctionSchema.safeParse(ir).success).toBe(true);
  });
});
