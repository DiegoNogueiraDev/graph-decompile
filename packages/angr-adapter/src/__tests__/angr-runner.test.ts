import { describe, it, expect } from "vitest";
import {
  buildAngrArgs,
  parseAngrOutput,
  type AngrRunnerOptions,
  type AngrExtractedData,
} from "../angr-runner.js";

describe("buildAngrArgs", () => {
  const baseOpts: AngrRunnerOptions = {
    pythonPath: "python3",
    workerScript: "/scripts/angr_worker.py",
    binaryPath: "/tmp/test.bin",
    outputPath: "/tmp/output.json",
    timeoutMs: 120_000,
  };

  it("builds correct python command args", () => {
    const args = buildAngrArgs(baseOpts);
    expect(args[0]).toBe("python3");
    expect(args[1]).toBe(baseOpts.workerScript);
    expect(args).toContain("--binary");
    expect(args).toContain(baseOpts.binaryPath);
    expect(args).toContain("--output");
    expect(args).toContain(baseOpts.outputPath);
  });

  it("includes timeout argument", () => {
    const args = buildAngrArgs(baseOpts);
    expect(args).toContain("--timeout");
    expect(args).toContain("120");
  });
});

describe("parseAngrOutput", () => {
  it("parses valid JSON with CFG and functions", () => {
    const data: AngrExtractedData = {
      status: "success",
      binary: { name: "test.bin", arch: "x86_64", format: "ELF" },
      functions: [
        {
          name: "main",
          address: "0x401000",
          blocks: [
            {
              address: "0x401000",
              size: 32,
              instructions: ["push rbp", "mov rbp, rsp"],
            },
          ],
          edges: [
            { from: "0x401000", to: "0x401020", type: "fallthrough" },
          ],
        },
      ],
      ail: {
        "0x401000": "v0 = stack_base - 0x8\nmem[v0] = rbp",
      },
    };

    const result = parseAngrOutput(JSON.stringify(data));
    expect(result.status).toBe("success");
    expect(result.functions).toHaveLength(1);
    expect(result.functions[0].blocks).toHaveLength(1);
    expect(result.functions[0].edges).toHaveLength(1);
    expect(result.ail).toBeDefined();
    expect(result.ail!["0x401000"]).toContain("stack_base");
  });

  it("returns error for invalid JSON", () => {
    const result = parseAngrOutput("not json{{{");
    expect(result.status).toBe("error");
    expect(result.error).toBeDefined();
  });

  it("returns error for missing functions field", () => {
    const result = parseAngrOutput(JSON.stringify({ status: "success" }));
    expect(result.status).toBe("error");
  });
});
