import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createDatabase,
  runMigrations,
  rollbackMigration,
  getMigrationVersion,
  type Database,
} from "../database.js";

let db: Database;

beforeEach(() => {
  db = createDatabase(":memory:");
  runMigrations(db);
});

afterEach(() => {
  db.close();
});

describe("migrations", () => {
  it("creates all required tables", () => {
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all() as { name: string }[];

    const names = tables.map((t) => t.name);
    expect(names).toContain("binaries");
    expect(names).toContain("functions");
    expect(names).toContain("artifacts");
    expect(names).toContain("hypotheses");
    expect(names).toContain("migrations");
  });

  it("tracks migration version", () => {
    const version = getMigrationVersion(db);
    expect(version).toBeGreaterThanOrEqual(1);
  });

  it("supports rollback", () => {
    const versionBefore = getMigrationVersion(db);
    rollbackMigration(db);
    const versionAfter = getMigrationVersion(db);
    expect(versionAfter).toBe(versionBefore - 1);
  });
});

describe("binaries table", () => {
  it("inserts and retrieves a binary", () => {
    db.prepare(
      "INSERT INTO binaries (hash, name, arch, size_bytes, imported_at) VALUES (?, ?, ?, ?, ?)",
    ).run("abc123", "test.bin", "x86_64", 1024, new Date().toISOString());

    const row = db.prepare("SELECT * FROM binaries WHERE hash = ?").get("abc123") as any;
    expect(row.name).toBe("test.bin");
    expect(row.arch).toBe("x86_64");
  });

  it("has index on hash", () => {
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='binaries'")
      .all() as { name: string }[];
    const names = indexes.map((i) => i.name);
    expect(names.some((n) => n.includes("hash"))).toBe(true);
  });
});

describe("functions table", () => {
  it("inserts and retrieves a function linked to a binary", () => {
    db.prepare(
      "INSERT INTO binaries (hash, name, arch, size_bytes, imported_at) VALUES (?, ?, ?, ?, ?)",
    ).run("abc123", "test.bin", "x86_64", 1024, new Date().toISOString());

    db.prepare(
      "INSERT INTO functions (id, binary_hash, address, raw_name, confidence) VALUES (?, ?, ?, ?, ?)",
    ).run("fn_001", "abc123", "0x401000", "FUN_00401000", 0.85);

    const row = db.prepare("SELECT * FROM functions WHERE id = ?").get("fn_001") as any;
    expect(row.binary_hash).toBe("abc123");
    expect(row.address).toBe("0x401000");
    expect(row.confidence).toBe(0.85);
  });

  it("has index on binary_hash", () => {
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='functions'")
      .all() as { name: string }[];
    const names = indexes.map((i) => i.name);
    expect(names.some((n) => n.includes("binary_hash"))).toBe(true);
  });

  it("has index on address", () => {
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='functions'")
      .all() as { name: string }[];
    const names = indexes.map((i) => i.name);
    expect(names.some((n) => n.includes("address"))).toBe(true);
  });
});

describe("artifacts table", () => {
  it("inserts and retrieves an artifact", () => {
    db.prepare(
      "INSERT INTO binaries (hash, name, arch, size_bytes, imported_at) VALUES (?, ?, ?, ?, ?)",
    ).run("abc123", "test.bin", "x86_64", 1024, new Date().toISOString());

    db.prepare(
      "INSERT INTO artifacts (id, binary_hash, type, path, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run("art_001", "abc123", "ghidra_json", "/workspace/abc123/ghidra.json", new Date().toISOString());

    const row = db.prepare("SELECT * FROM artifacts WHERE id = ?").get("art_001") as any;
    expect(row.type).toBe("ghidra_json");
  });
});

describe("hypotheses table", () => {
  it("inserts and retrieves a hypothesis", () => {
    db.prepare(
      "INSERT INTO binaries (hash, name, arch, size_bytes, imported_at) VALUES (?, ?, ?, ?, ?)",
    ).run("abc123", "test.bin", "x86_64", 1024, new Date().toISOString());

    db.prepare(
      "INSERT INTO functions (id, binary_hash, address, raw_name, confidence) VALUES (?, ?, ?, ?, ?)",
    ).run("fn_001", "abc123", "0x401000", "FUN_00401000", 0.85);

    db.prepare(
      "INSERT INTO hypotheses (id, function_id, type, value, confidence, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("hyp_001", "fn_001", "name_suggestion", "processInput", 0.7, "genai", new Date().toISOString());

    const row = db.prepare("SELECT * FROM hypotheses WHERE id = ?").get("hyp_001") as any;
    expect(row.type).toBe("name_suggestion");
    expect(row.confidence).toBe(0.7);
    expect(row.source).toBe("genai");
  });
});
