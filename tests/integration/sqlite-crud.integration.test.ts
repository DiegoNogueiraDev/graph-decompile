import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createDatabase,
  runMigrations,
  type Database,
} from "@genai-decompiler/storage";
import { CanonicalFunctionSchema } from "@genai-decompiler/core-contracts";

let db: Database;

beforeEach(() => {
  db = createDatabase(":memory:");
  runMigrations(db);
});

afterEach(() => {
  db.close();
});

// ── Realistic fixtures ──────────────────────────────────────────────────────

const BINARY_HASH = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd";

const REALISTIC_IR = {
  id: "ghidra_0x401000_0",
  binaryHash: BINARY_HASH,
  backendSources: ["ghidra"],
  arch: "x86_64" as const,
  address: "0x401000",
  rawName: "FUN_00401000",
  normalizedName: "processInput",
  confidence: 0.85,
  blocks: [
    {
      id: "block_0x401000",
      address: "0x401000",
      instructions: [
        { address: "0x401000", mnemonic: "push", operands: "rbp" },
        { address: "0x401001", mnemonic: "mov", operands: "rbp, rsp" },
        { address: "0x401004", mnemonic: "sub", operands: "rsp, 0x20" },
      ],
      confidence: 0.9,
    },
    {
      id: "block_0x401020",
      address: "0x401020",
      instructions: [
        { address: "0x401020", mnemonic: "call", operands: "printf" },
        { address: "0x401025", mnemonic: "leave", operands: "" },
        { address: "0x401026", mnemonic: "ret", operands: "" },
      ],
      confidence: 0.9,
    },
  ],
  edges: [
    { from: "block_0x401000", to: "block_0x401020", type: "fallthrough" as const, confidence: 0.9 },
  ],
  variables: [
    { id: "var_rsp_minus_8", name: "buf", type: "char*", scope: "local" as const, confidence: 0.7 },
    { id: "param_rdi", name: "argc", type: "int", scope: "parameter" as const, confidence: 0.8 },
  ],
  calls: [
    { address: "0x401020", targetName: "printf", targetAddress: "0x403000", confidence: 0.95 },
  ],
  strings: [
    { address: "0x402000", value: "Hello, world!", confidence: 0.99 },
  ],
  imports: [
    { name: "printf", library: "libc.so.6", address: "0x403000", confidence: 0.99 },
  ],
  typeHints: [
    { targetId: "var_rsp_minus_8", suggestedType: "const char*", source: "ghidra", confidence: 0.6 },
  ],
  pseudocode: "int processInput(int argc) {\n  printf(\"Hello, world!\");\n  return 0;\n}",
  semantics: {
    purpose: "Prints a greeting message",
    sideEffects: ["stdout"],
    purity: "impure" as const,
  },
  diagnostics: [
    { code: "DECOMPILE_OK", message: "Decompilation successful", severity: "info" as const },
  ],
};

function insertBinary(hash: string = BINARY_HASH, name: string = "test.elf") {
  db.prepare(
    "INSERT INTO binaries (hash, name, arch, size_bytes, imported_at) VALUES (?, ?, ?, ?, ?)",
  ).run(hash, name, "x86_64", 5632000, new Date().toISOString());
}

function insertFunction(id: string, binaryHash: string, address: string, rawName: string, irJson?: string) {
  db.prepare(
    "INSERT INTO functions (id, binary_hash, address, raw_name, confidence, ir_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(id, binaryHash, address, rawName, 0.85, irJson ?? null, new Date().toISOString(), new Date().toISOString());
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("SQLite CRUD integration — binaries", () => {
  it("inserts, reads, updates, and deletes a binary", () => {
    // CREATE
    insertBinary();

    // READ
    const row = db.prepare("SELECT * FROM binaries WHERE hash = ?").get(BINARY_HASH) as any;
    expect(row.name).toBe("test.elf");
    expect(row.arch).toBe("x86_64");
    expect(row.size_bytes).toBe(5632000);

    // UPDATE
    db.prepare("UPDATE binaries SET name = ? WHERE hash = ?").run("updated.elf", BINARY_HASH);
    const updated = db.prepare("SELECT * FROM binaries WHERE hash = ?").get(BINARY_HASH) as any;
    expect(updated.name).toBe("updated.elf");

    // DELETE
    db.prepare("DELETE FROM binaries WHERE hash = ?").run(BINARY_HASH);
    const deleted = db.prepare("SELECT * FROM binaries WHERE hash = ?").get(BINARY_HASH);
    expect(deleted).toBeUndefined();
  });

  it("enforces unique hash constraint", () => {
    insertBinary();
    expect(() => insertBinary()).toThrow();
  });

  it("lists multiple binaries", () => {
    insertBinary("hash_1", "bin_a.elf");
    insertBinary("hash_2", "bin_b.elf");
    insertBinary("hash_3", "bin_c.elf");

    const rows = db.prepare("SELECT * FROM binaries ORDER BY name").all() as any[];
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.name)).toEqual(["bin_a.elf", "bin_b.elf", "bin_c.elf"]);
  });
});

describe("SQLite CRUD integration — functions with IR JSON", () => {
  beforeEach(() => {
    insertBinary();
  });

  it("stores and retrieves full CanonicalFunction IR as JSON", () => {
    const irJson = JSON.stringify(REALISTIC_IR);
    insertFunction("fn_main", BINARY_HASH, "0x401000", "FUN_00401000", irJson);

    const row = db.prepare("SELECT * FROM functions WHERE id = ?").get("fn_main") as any;
    expect(row.ir_json).toBeTruthy();

    const parsed = JSON.parse(row.ir_json);
    // Validate against Zod schema
    const result = CanonicalFunctionSchema.safeParse(parsed);
    expect(result.success).toBe(true);

    // Verify key fields survived round-trip
    expect(parsed.blocks).toHaveLength(2);
    expect(parsed.edges).toHaveLength(1);
    expect(parsed.variables).toHaveLength(2);
    expect(parsed.calls).toHaveLength(1);
    expect(parsed.strings).toHaveLength(1);
    expect(parsed.imports).toHaveLength(1);
    expect(parsed.pseudocode).toContain("processInput");
    expect(parsed.semantics.purpose).toBe("Prints a greeting message");
  });

  it("updates function IR and normalizedName", () => {
    const irJson = JSON.stringify(REALISTIC_IR);
    insertFunction("fn_main", BINARY_HASH, "0x401000", "FUN_00401000", irJson);

    // Update normalizedName and IR
    const updatedIr = { ...REALISTIC_IR, normalizedName: "handleUserInput" };
    db.prepare(
      "UPDATE functions SET normalized_name = ?, ir_json = ?, updated_at = ? WHERE id = ?",
    ).run("handleUserInput", JSON.stringify(updatedIr), new Date().toISOString(), "fn_main");

    const row = db.prepare("SELECT * FROM functions WHERE id = ?").get("fn_main") as any;
    expect(row.normalized_name).toBe("handleUserInput");
    const parsed = JSON.parse(row.ir_json);
    expect(parsed.normalizedName).toBe("handleUserInput");
  });

  it("queries functions by binary_hash", () => {
    insertFunction("fn_1", BINARY_HASH, "0x401000", "main");
    insertFunction("fn_2", BINARY_HASH, "0x402000", "helper");
    insertFunction("fn_3", BINARY_HASH, "0x403000", "cleanup");

    const rows = db.prepare("SELECT * FROM functions WHERE binary_hash = ? ORDER BY address").all(BINARY_HASH) as any[];
    expect(rows).toHaveLength(3);
    expect(rows[0].raw_name).toBe("main");
    expect(rows[2].raw_name).toBe("cleanup");
  });

  it("queries functions by address", () => {
    insertFunction("fn_1", BINARY_HASH, "0x401000", "main");

    const row = db.prepare("SELECT * FROM functions WHERE address = ?").get("0x401000") as any;
    expect(row.raw_name).toBe("main");
  });

  it("deletes function and cleans up", () => {
    insertFunction("fn_1", BINARY_HASH, "0x401000", "main");
    db.prepare("DELETE FROM functions WHERE id = ?").run("fn_1");
    const row = db.prepare("SELECT * FROM functions WHERE id = ?").get("fn_1");
    expect(row).toBeUndefined();
  });
});

describe("SQLite CRUD integration — artifacts", () => {
  beforeEach(() => {
    insertBinary();
  });

  it("stores artifact with metadata JSON", () => {
    const metadata = { tool: "ghidra", version: "11.2.1", analysisTime: 42.5 };
    db.prepare(
      "INSERT INTO artifacts (id, binary_hash, type, path, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("art_ghidra", BINARY_HASH, "ghidra_json", "/workspace/ghidra/output.json", JSON.stringify(metadata), new Date().toISOString());

    const row = db.prepare("SELECT * FROM artifacts WHERE id = ?").get("art_ghidra") as any;
    const parsed = JSON.parse(row.metadata_json);
    expect(parsed.tool).toBe("ghidra");
    expect(parsed.analysisTime).toBe(42.5);
  });

  it("lists artifacts by binary and type", () => {
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO artifacts (id, binary_hash, type, path, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run("art_1", BINARY_HASH, "ghidra_json", "/ws/ghidra.json", now);
    db.prepare(
      "INSERT INTO artifacts (id, binary_hash, type, path, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run("art_2", BINARY_HASH, "angr_json", "/ws/angr.json", now);
    db.prepare(
      "INSERT INTO artifacts (id, binary_hash, type, path, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run("art_3", BINARY_HASH, "ir_canonical", "/ws/ir.json", now);

    const ghidraArts = db.prepare("SELECT * FROM artifacts WHERE binary_hash = ? AND type = ?").all(BINARY_HASH, "ghidra_json") as any[];
    expect(ghidraArts).toHaveLength(1);

    const allArts = db.prepare("SELECT * FROM artifacts WHERE binary_hash = ?").all(BINARY_HASH) as any[];
    expect(allArts).toHaveLength(3);
  });
});

describe("SQLite CRUD integration — hypotheses", () => {
  beforeEach(() => {
    insertBinary();
    insertFunction("fn_main", BINARY_HASH, "0x401000", "FUN_00401000");
  });

  it("stores and retrieves GenAI hypotheses", () => {
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO hypotheses (id, function_id, type, value, confidence, source, accepted, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run("hyp_name", "fn_main", "name_suggestion", "processInput", 0.82, "genai", 0, now);
    db.prepare(
      "INSERT INTO hypotheses (id, function_id, type, value, confidence, source, accepted, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run("hyp_type", "fn_main", "type_suggestion", "int (*)(int, char**)", 0.65, "genai", 0, now);

    const hypotheses = db.prepare("SELECT * FROM hypotheses WHERE function_id = ? ORDER BY type").all("fn_main") as any[];
    expect(hypotheses).toHaveLength(2);
    expect(hypotheses[0].type).toBe("name_suggestion");
    expect(hypotheses[1].type).toBe("type_suggestion");
  });

  it("updates hypothesis acceptance", () => {
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO hypotheses (id, function_id, type, value, confidence, source, accepted, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run("hyp_1", "fn_main", "name_suggestion", "processInput", 0.82, "genai", 0, now);

    // Accept the hypothesis
    db.prepare("UPDATE hypotheses SET accepted = 1 WHERE id = ?").run("hyp_1");

    const row = db.prepare("SELECT * FROM hypotheses WHERE id = ?").get("hyp_1") as any;
    expect(row.accepted).toBe(1);
  });

  it("queries hypotheses by confidence threshold", () => {
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO hypotheses (id, function_id, type, value, confidence, source, accepted, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run("hyp_high", "fn_main", "name_suggestion", "processInput", 0.9, "genai", 0, now);
    db.prepare(
      "INSERT INTO hypotheses (id, function_id, type, value, confidence, source, accepted, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run("hyp_low", "fn_main", "name_suggestion", "doStuff", 0.3, "genai", 0, now);

    const highConf = db.prepare("SELECT * FROM hypotheses WHERE confidence >= 0.7").all() as any[];
    expect(highConf).toHaveLength(1);
    expect(highConf[0].value).toBe("processInput");
  });
});

describe("SQLite CRUD integration — foreign key cascading", () => {
  it("prevents inserting function for non-existent binary", () => {
    expect(() =>
      insertFunction("fn_orphan", "nonexistent_hash", "0x401000", "orphan"),
    ).toThrow();
  });

  it("prevents inserting hypothesis for non-existent function", () => {
    expect(() =>
      db.prepare(
        "INSERT INTO hypotheses (id, function_id, type, value, confidence, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ).run("hyp_orphan", "nonexistent_fn", "name_suggestion", "test", 0.5, "genai", new Date().toISOString()),
    ).toThrow();
  });
});

describe("SQLite CRUD integration — full lifecycle", () => {
  it("simulates complete analysis workflow: import → analyze → persist → query → cleanup", () => {
    // 1. Import binary
    insertBinary();

    // 2. Persist multiple functions with IR
    const functions = [
      { id: "fn_main", address: "0x401000", name: "main" },
      { id: "fn_helper", address: "0x402000", name: "helper_func" },
      { id: "fn_init", address: "0x403000", name: "_init" },
    ];

    const insertFn = db.prepare(
      "INSERT INTO functions (id, binary_hash, address, raw_name, confidence, ir_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );

    const now = new Date().toISOString();
    for (const fn of functions) {
      const ir = { ...REALISTIC_IR, id: fn.id, address: fn.address, rawName: fn.name };
      insertFn.run(fn.id, BINARY_HASH, fn.address, fn.name, 0.85, JSON.stringify(ir), now, now);
    }

    // 3. Store artifacts
    db.prepare(
      "INSERT INTO artifacts (id, binary_hash, type, path, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("art_ghidra", BINARY_HASH, "ghidra_json", "/ws/ghidra.json", JSON.stringify({ functions: 3 }), now);

    // 4. Store hypotheses
    db.prepare(
      "INSERT INTO hypotheses (id, function_id, type, value, confidence, source, accepted, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run("hyp_1", "fn_main", "name_suggestion", "processInput", 0.85, "genai", 0, now);

    // 5. Query: find all functions for binary
    const allFns = db.prepare("SELECT * FROM functions WHERE binary_hash = ?").all(BINARY_HASH) as any[];
    expect(allFns).toHaveLength(3);

    // 6. Query: get function with valid IR
    const mainFn = db.prepare("SELECT * FROM functions WHERE id = ?").get("fn_main") as any;
    const ir = JSON.parse(mainFn.ir_json);
    const validation = CanonicalFunctionSchema.safeParse(ir);
    expect(validation.success).toBe(true);

    // 7. Query: get hypotheses for function
    const hyps = db.prepare("SELECT * FROM hypotheses WHERE function_id = ?").all("fn_main") as any[];
    expect(hyps).toHaveLength(1);

    // 8. Accept hypothesis and update function name
    db.prepare("UPDATE hypotheses SET accepted = 1 WHERE id = ?").run("hyp_1");
    db.prepare("UPDATE functions SET normalized_name = ? WHERE id = ?").run("processInput", "fn_main");

    const updatedFn = db.prepare("SELECT normalized_name FROM functions WHERE id = ?").get("fn_main") as any;
    expect(updatedFn.normalized_name).toBe("processInput");

    // 9. Verify counts
    const binaryCount = (db.prepare("SELECT COUNT(*) as count FROM binaries").get() as any).count;
    const fnCount = (db.prepare("SELECT COUNT(*) as count FROM functions").get() as any).count;
    const artCount = (db.prepare("SELECT COUNT(*) as count FROM artifacts").get() as any).count;
    const hypCount = (db.prepare("SELECT COUNT(*) as count FROM hypotheses").get() as any).count;

    expect(binaryCount).toBe(1);
    expect(fnCount).toBe(3);
    expect(artCount).toBe(1);
    expect(hypCount).toBe(1);
  });
});
