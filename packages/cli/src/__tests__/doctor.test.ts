import { describe, it, expect } from "vitest";
import {
  checkNode,
  checkJava,
  checkGhidra,
  checkPython,
  checkAngr,
  runDoctor,
  type DependencyCheck,
  type DoctorResult,
} from "../doctor.js";

describe("checkNode", () => {
  it("returns ok for Node >= 18", async () => {
    const result = await checkNode();
    expect(result.name).toBe("node");
    // We're running on Node, so it should pass
    expect(result.ok).toBe(true);
    expect(result.version).toBeDefined();
  });
});

describe("checkJava", () => {
  it("returns a DependencyCheck with name java", async () => {
    const result = await checkJava();
    expect(result.name).toBe("java");
    expect(typeof result.ok).toBe("boolean");
  });
});

describe("checkGhidra", () => {
  it("returns ok when ghidraPath is valid", async () => {
    // Use the local ghidra installation
    const result = await checkGhidra("/Users/diegonogueira/graph-decompile/ghidra");
    expect(result.name).toBe("ghidra");
    expect(result.ok).toBe(true);
    expect(result.path).toBeDefined();
  });

  it("returns not ok when ghidraPath is invalid", async () => {
    const result = await checkGhidra("/nonexistent/ghidra");
    expect(result.ok).toBe(false);
  });
});

describe("checkPython", () => {
  it("returns a DependencyCheck with name python", async () => {
    const result = await checkPython();
    expect(result.name).toBe("python");
    expect(typeof result.ok).toBe("boolean");
  });
});

describe("checkAngr", () => {
  it("returns a DependencyCheck with name angr", async () => {
    const result = await checkAngr();
    expect(result.name).toBe("angr");
    expect(typeof result.ok).toBe("boolean");
  });
});

describe("runDoctor", () => {
  it("returns results for all 5 dependencies", async () => {
    const result = await runDoctor({ ghidraPath: "/nonexistent" });
    expect(result.checks).toHaveLength(5);
    const names = result.checks.map((c) => c.name);
    expect(names).toContain("node");
    expect(names).toContain("java");
    expect(names).toContain("ghidra");
    expect(names).toContain("python");
    expect(names).toContain("angr");
  });

  it("returns allOk boolean", async () => {
    const result = await runDoctor({ ghidraPath: "/nonexistent" });
    expect(typeof result.allOk).toBe("boolean");
  });
});
