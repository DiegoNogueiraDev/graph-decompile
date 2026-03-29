import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  saveDoctorConfig,
  loadConfig,
  type DependencyCheck,
} from "../doctor.js";

describe("saveDoctorConfig", () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it("saves detected paths to config.json", () => {
    tempDir = mkdtempSync(join(tmpdir(), "gdmcp-test-"));
    const checks: DependencyCheck[] = [
      { name: "node", ok: true, version: "20.0.0" },
      { name: "java", ok: true, version: "openjdk 17.0.1" },
      { name: "ghidra", ok: true, path: "/opt/ghidra" },
      { name: "python", ok: true, version: "3.11.0", path: "python3" },
      { name: "angr", ok: true },
    ];

    saveDoctorConfig(checks, tempDir);

    const configPath = join(tempDir, "config.json");
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(config.node.version).toBe("20.0.0");
    expect(config.ghidra.path).toBe("/opt/ghidra");
    expect(config.python.path).toBe("python3");
  });

  it("creates directory if it does not exist", () => {
    tempDir = mkdtempSync(join(tmpdir(), "gdmcp-test-"));
    const nestedDir = join(tempDir, "nested", ".gdmcp");
    const checks: DependencyCheck[] = [
      { name: "node", ok: true, version: "20.0.0" },
    ];

    saveDoctorConfig(checks, nestedDir);

    const config = JSON.parse(readFileSync(join(nestedDir, "config.json"), "utf-8"));
    expect(config.node.version).toBe("20.0.0");
  });
});

describe("loadConfig", () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it("loads saved config", () => {
    tempDir = mkdtempSync(join(tmpdir(), "gdmcp-test-"));
    const checks: DependencyCheck[] = [
      { name: "ghidra", ok: true, path: "/opt/ghidra" },
    ];
    saveDoctorConfig(checks, tempDir);

    const config = loadConfig(tempDir);
    expect(config.ghidra?.path).toBe("/opt/ghidra");
  });

  it("returns empty object for missing config", () => {
    const config = loadConfig("/nonexistent/path");
    expect(config).toEqual({});
  });
});
