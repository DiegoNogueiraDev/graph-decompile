import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildHeadlessArgs,
  parseGhidraOutput,
  type GhidraRunnerOptions,
  type GhidraExtractedData,
} from "../ghidra-runner.js";

describe("buildHeadlessArgs", () => {
  const baseOpts: GhidraRunnerOptions = {
    ghidraPath: "/opt/ghidra",
    binaryPath: "/tmp/test.bin",
    projectDir: "/tmp/ghidra-projects",
    projectName: "test_project",
    scriptPath: "/scripts/ExtractAll.java",
    outputPath: "/tmp/output.json",
    timeoutMs: 120_000,
  };

  it("builds correct analyzeHeadless command args", () => {
    const args = buildHeadlessArgs(baseOpts);
    expect(args[0]).toContain("analyzeHeadless");
    expect(args).toContain(baseOpts.projectDir);
    expect(args).toContain(baseOpts.projectName);
    expect(args).toContain("-import");
    expect(args).toContain(baseOpts.binaryPath);
    expect(args).toContain("-postScript");
    expect(args).toContain(baseOpts.scriptPath);
  });

  it("includes output path as script argument", () => {
    const args = buildHeadlessArgs(baseOpts);
    const postScriptIdx = args.indexOf("-postScript");
    // output path should be after script path
    expect(args[postScriptIdx + 2]).toBe(baseOpts.outputPath);
  });

  it("includes -deleteProject to avoid stale state", () => {
    const args = buildHeadlessArgs(baseOpts);
    expect(args).toContain("-deleteProject");
  });
});

describe("parseGhidraOutput", () => {
  it("parses valid JSON output with functions", () => {
    const json: GhidraExtractedData = {
      status: "success",
      binary: { name: "test.bin", arch: "x86_64", format: "ELF" },
      functions: [
        { name: "main", address: "0x401000", size: 128 },
        { name: "FUN_00401100", address: "0x401100", size: 64 },
      ],
      strings: [
        { address: "0x402000", value: "Hello World" },
      ],
      imports: [
        { name: "printf", library: "libc.so.6", address: "0x403000" },
      ],
    };

    const result = parseGhidraOutput(JSON.stringify(json));
    expect(result.status).toBe("success");
    expect(result.functions).toHaveLength(2);
    expect(result.functions[0].name).toBe("main");
    expect(result.strings).toHaveLength(1);
    expect(result.imports).toHaveLength(1);
  });

  it("returns error status for invalid JSON", () => {
    const result = parseGhidraOutput("not valid json{{{");
    expect(result.status).toBe("error");
    expect(result.error).toBeDefined();
  });

  it("returns error status for missing required fields", () => {
    const result = parseGhidraOutput(JSON.stringify({ incomplete: true }));
    expect(result.status).toBe("error");
  });
});
