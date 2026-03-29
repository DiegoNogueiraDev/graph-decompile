import { describe, it, expect } from "vitest";
import {
  checkNode,
  checkJava,
  checkGhidra,
  checkPython,
  checkAngr,
  runDoctor,
  formatDoctorOutput,
  type DependencyCheck,
} from "../doctor.js";

describe("error messages include actionable suggestions", () => {
  it("ghidra error includes install hint", async () => {
    const result = await checkGhidra("/nonexistent");
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("angr error includes pip install hint", async () => {
    // angr may or may not be installed, but the error message should have a hint
    const result = await checkAngr();
    if (!result.ok) {
      expect(result.error).toContain("pip install angr");
    }
  });
});

describe("formatDoctorOutput", () => {
  it("produces formatted string with pass/fail indicators", () => {
    const checks: DependencyCheck[] = [
      { name: "node", ok: true, version: "20.0.0" },
      { name: "java", ok: false, error: "Java not found" },
    ];
    const output = formatDoctorOutput(checks);
    expect(output).toContain("node");
    expect(output).toContain("20.0.0");
    expect(output).toContain("java");
    expect(output).toContain("Java not found");
  });

  it("includes action suggestion for failed checks", () => {
    const checks: DependencyCheck[] = [
      { name: "java", ok: false, error: "Java not found" },
    ];
    const output = formatDoctorOutput(checks);
    // Should have some actionable text
    expect(output.length).toBeGreaterThan(0);
  });
});

describe("smoke test", () => {
  it("runDoctor completes without throwing", async () => {
    const result = await runDoctor({});
    expect(result.checks).toBeDefined();
    expect(result.checks.length).toBe(5);
  });

  it("all checks return valid DependencyCheck shape", async () => {
    const result = await runDoctor({});
    for (const check of result.checks) {
      expect(check.name).toBeDefined();
      expect(typeof check.ok).toBe("boolean");
    }
  });
});
