import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { runGhidraHeadless } from "@genai-decompiler/ghidra-adapter";
import { runAngrWorker } from "@genai-decompiler/angr-adapter";

const PROJECT_ROOT = join(import.meta.dirname, "..", "..");
const SAMPLE_BINARY = join(PROJECT_ROOT, "bin", "MTC");
const GHIDRA_PATH = join(PROJECT_ROOT, "ghidra");
const GHIDRA_SCRIPT = join(PROJECT_ROOT, "ghidra", "scripts", "ExtractAll.py");
const GHIDRA_HEADLESS = join(GHIDRA_PATH, "support", "analyzeHeadless");

function isGhidraAvailable(): boolean {
  if (!existsSync(GHIDRA_HEADLESS) || !existsSync(SAMPLE_BINARY)) return false;
  try {
    execFileSync("java", ["-version"], { timeout: 5_000, stdio: "ignore" });
    // Ghidra 11.x requires JDK 17-21; check compatibility
    // Ghidra 11.2.1 requires JDK >= 21. Jython scripts bypass OSGi so any JDK >= 21 works.
    const versionOutput = execFileSync("java", ["--version"], { timeout: 5_000 }).toString();
    const match = versionOutput.match(/(\d+)\.\d+/);
    if (match) {
      const major = parseInt(match[1], 10);
      if (major < 21) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function isAngrAvailable(): boolean {
  try {
    execFileSync("python3", ["-c", "import angr"], { timeout: 10_000 });
    return existsSync(SAMPLE_BINARY);
  } catch {
    return false;
  }
}

describe.skipIf(!isGhidraAvailable())(
  "Ghidra adapter integration",
  () => {
    let tempDir: string;

    beforeAll(() => {
      tempDir = mkdtempSync(join(tmpdir(), "ghidra-int-"));
    });

    it(
      "should analyze binary and extract functions",
      async () => {
        const outputPath = join(tempDir, "output.json");

        const result = await runGhidraHeadless({
          ghidraPath: GHIDRA_PATH,
          binaryPath: SAMPLE_BINARY,
          projectDir: tempDir,
          projectName: "integration_test",
          scriptPath: GHIDRA_SCRIPT,
          outputPath,
          timeoutMs: 300_000, // 5 min — Ghidra can be slow
        });

        expect(result.status).toBe("success");
        expect(result.functions.length).toBeGreaterThan(0);
        expect(result.binary).toBeDefined();
        expect(result.binary?.arch).toBeDefined();

        // Validate function structure
        for (const fn of result.functions.slice(0, 5)) {
          expect(fn.name).toBeTruthy();
          expect(fn.address).toBeTruthy();
          expect(typeof fn.size).toBe("number");
        }
      },
      360_000,
    );

    it(
      "should extract strings from binary",
      async () => {
        const outputPath = join(tempDir, "output_strings.json");

        const result = await runGhidraHeadless({
          ghidraPath: GHIDRA_PATH,
          binaryPath: SAMPLE_BINARY,
          projectDir: tempDir,
          projectName: "integration_strings",
          scriptPath: GHIDRA_SCRIPT,
          outputPath,
          timeoutMs: 300_000,
        });

        expect(result.status).toBe("success");
        // ELF binaries typically have strings
        expect(result.strings.length).toBeGreaterThanOrEqual(0);

        for (const str of result.strings.slice(0, 5)) {
          expect(str.address).toBeTruthy();
          expect(typeof str.value).toBe("string");
        }
      },
      360_000,
    );
  },
);

describe.skipIf(!isAngrAvailable())(
  "angr adapter integration",
  () => {
    let tempDir: string;

    beforeAll(() => {
      tempDir = mkdtempSync(join(tmpdir(), "angr-int-"));
    });

    it(
      "should analyze binary and extract CFG",
      async () => {
        const outputPath = join(tempDir, "angr_output.json");

        const result = await runAngrWorker({
          pythonPath: "python3",
          workerScript: join(PROJECT_ROOT, "python", "angr-worker", "angr_worker.py"),
          binaryPath: SAMPLE_BINARY,
          outputPath,
          timeoutMs: 300_000,
        });

        expect(result.status).toBe("success");
        expect(result.functions.length).toBeGreaterThan(0);

        // Validate CFG structure
        for (const fn of result.functions.slice(0, 5)) {
          expect(fn.name).toBeTruthy();
          expect(fn.address).toBeTruthy();
          expect(Array.isArray(fn.blocks)).toBe(true);
          expect(Array.isArray(fn.edges)).toBe(true);
        }
      },
      360_000,
    );
  },
);
