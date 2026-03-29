import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { hashBinary, createWorkspace } from "../workspace.js";

describe("hashBinary", () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it("computes SHA-256 of a binary file", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "hash-test-"));
    const binPath = join(tempDir, "test.bin");
    writeFileSync(binPath, Buffer.from("hello binary"));

    const hash = await hashBinary(binPath);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns consistent hash for same content", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "hash-test-"));
    const bin1 = join(tempDir, "a.bin");
    const bin2 = join(tempDir, "b.bin");
    writeFileSync(bin1, Buffer.from("same content"));
    writeFileSync(bin2, Buffer.from("same content"));

    const hash1 = await hashBinary(bin1);
    const hash2 = await hashBinary(bin2);
    expect(hash1).toBe(hash2);
  });

  it("returns different hash for different content", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "hash-test-"));
    const bin1 = join(tempDir, "a.bin");
    const bin2 = join(tempDir, "b.bin");
    writeFileSync(bin1, Buffer.from("content A"));
    writeFileSync(bin2, Buffer.from("content B"));

    const hash1 = await hashBinary(bin1);
    const hash2 = await hashBinary(bin2);
    expect(hash1).not.toBe(hash2);
  });
});

describe("createWorkspace", () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates workspace directory named by hash", () => {
    tempDir = mkdtempSync(join(tmpdir(), "ws-test-"));
    const hash = "abc123def456";
    const wsPath = createWorkspace(tempDir, hash);
    expect(existsSync(wsPath)).toBe(true);
    expect(wsPath).toContain(hash);
  });

  it("is idempotent — does not fail if dir exists", () => {
    tempDir = mkdtempSync(join(tmpdir(), "ws-test-"));
    const hash = "abc123def456";
    const ws1 = createWorkspace(tempDir, hash);
    const ws2 = createWorkspace(tempDir, hash);
    expect(ws1).toBe(ws2);
  });
});
