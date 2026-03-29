import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createWorkspaceWithArtifacts, isWorkspaceCached, ARTIFACT_DIRS } from "../workspace.js";

describe("createWorkspaceWithArtifacts", () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates workspace with artifact subdirectories", () => {
    tempDir = mkdtempSync(join(tmpdir(), "ws-art-"));
    const hash = "abc123def456";
    const wsPath = createWorkspaceWithArtifacts(tempDir, hash);

    for (const dir of ARTIFACT_DIRS) {
      expect(existsSync(join(wsPath, dir))).toBe(true);
    }
  });

  it("creates ghidra/, angr/, ir/, hypotheses/ subdirectories", () => {
    tempDir = mkdtempSync(join(tmpdir(), "ws-art-"));
    const wsPath = createWorkspaceWithArtifacts(tempDir, "hash123");

    expect(existsSync(join(wsPath, "ghidra"))).toBe(true);
    expect(existsSync(join(wsPath, "angr"))).toBe(true);
    expect(existsSync(join(wsPath, "ir"))).toBe(true);
    expect(existsSync(join(wsPath, "hypotheses"))).toBe(true);
  });

  it("is idempotent", () => {
    tempDir = mkdtempSync(join(tmpdir(), "ws-art-"));
    const hash = "abc123";
    const ws1 = createWorkspaceWithArtifacts(tempDir, hash);
    const ws2 = createWorkspaceWithArtifacts(tempDir, hash);
    expect(ws1).toBe(ws2);
  });
});

describe("isWorkspaceCached", () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns true when workspace exists", () => {
    tempDir = mkdtempSync(join(tmpdir(), "ws-cache-"));
    createWorkspaceWithArtifacts(tempDir, "hash123");
    expect(isWorkspaceCached(tempDir, "hash123")).toBe(true);
  });

  it("returns false when workspace does not exist", () => {
    tempDir = mkdtempSync(join(tmpdir(), "ws-cache-"));
    expect(isWorkspaceCached(tempDir, "nonexistent")).toBe(false);
  });
});
