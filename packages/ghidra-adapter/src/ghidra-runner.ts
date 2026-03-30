import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface GhidraRunnerOptions {
  ghidraPath: string;
  binaryPath: string;
  projectDir: string;
  projectName: string;
  scriptPath: string;
  outputPath: string;
  timeoutMs: number;
}

export interface GhidraExtractedFunction {
  name: string;
  address: string;
  size: number;
}

export interface GhidraExtractedString {
  address: string;
  value: string;
}

export interface GhidraExtractedImport {
  name: string;
  library: string;
  address: string;
}

export interface GhidraExtractedData {
  status: "success" | "error";
  error?: string;
  binary?: { name: string; arch: string; format: string };
  functions: GhidraExtractedFunction[];
  strings: GhidraExtractedString[];
  imports: GhidraExtractedImport[];
}

export function buildHeadlessArgs(opts: GhidraRunnerOptions): string[] {
  const analyzeHeadless = join(opts.ghidraPath, "support", "analyzeHeadless");

  return [
    analyzeHeadless,
    opts.projectDir,
    opts.projectName,
    "-import",
    opts.binaryPath,
    "-scriptPath",
    dirname(opts.scriptPath),
    "-postScript",
    opts.scriptPath,
    opts.outputPath,
    "-deleteProject",
    "-analysisTimeoutPerFile",
    String(Math.floor(opts.timeoutMs / 1000)),
  ];
}

export function parseGhidraOutput(raw: string): GhidraExtractedData {
  try {
    const data = JSON.parse(raw);

    if (!data.status || !data.functions || !Array.isArray(data.functions)) {
      return {
        status: "error",
        error: "Missing required fields: status, functions",
        functions: [],
        strings: [],
        imports: [],
      };
    }

    return {
      status: data.status,
      binary: data.binary,
      functions: data.functions,
      strings: data.strings ?? [],
      imports: data.imports ?? [],
    };
  } catch (err) {
    return {
      status: "error",
      error: `Failed to parse Ghidra output: ${err instanceof Error ? err.message : String(err)}`,
      functions: [],
      strings: [],
      imports: [],
    };
  }
}

export async function runGhidraHeadless(
  opts: GhidraRunnerOptions,
): Promise<GhidraExtractedData> {
  const args = buildHeadlessArgs(opts);
  const command = args[0];
  const commandArgs = args.slice(1);

  return new Promise((resolve) => {
    const child = execFile(command, commandArgs, { timeout: opts.timeoutMs }, (err) => {
      if (err) {
        resolve({
          status: "error",
          error: `Ghidra headless failed: ${err.message}`,
          functions: [],
          strings: [],
          imports: [],
        });
        return;
      }

      try {
        const output = readFileSync(opts.outputPath, "utf-8");
        resolve(parseGhidraOutput(output));
      } catch (readErr) {
        resolve({
          status: "error",
          error: `Failed to read output: ${readErr instanceof Error ? readErr.message : String(readErr)}`,
          functions: [],
          strings: [],
          imports: [],
        });
      }
    });
  });
}
