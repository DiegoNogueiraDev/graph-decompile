import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";

export interface AngrRunnerOptions {
  pythonPath: string;
  workerScript: string;
  binaryPath: string;
  outputPath: string;
  timeoutMs: number;
}

export interface AngrExtractedBlock {
  address: string;
  size: number;
  instructions: string[];
}

export interface AngrExtractedEdge {
  from: string;
  to: string;
  type: string;
}

export interface AngrExtractedFunction {
  name: string;
  address: string;
  blocks: AngrExtractedBlock[];
  edges: AngrExtractedEdge[];
}

export interface AngrExtractedData {
  status: "success" | "error";
  error?: string;
  binary?: { name: string; arch: string; format: string };
  functions: AngrExtractedFunction[];
  ail?: Record<string, string>;
}

export function buildAngrArgs(opts: AngrRunnerOptions): string[] {
  return [
    opts.pythonPath,
    opts.workerScript,
    "--binary",
    opts.binaryPath,
    "--output",
    opts.outputPath,
    "--timeout",
    String(Math.floor(opts.timeoutMs / 1000)),
  ];
}

export function parseAngrOutput(raw: string): AngrExtractedData {
  try {
    const data = JSON.parse(raw);

    if (!data.status || !data.functions || !Array.isArray(data.functions)) {
      return {
        status: "error",
        error: "Missing required fields: status, functions",
        functions: [],
      };
    }

    return {
      status: data.status,
      binary: data.binary,
      functions: data.functions,
      ail: data.ail,
    };
  } catch (err) {
    return {
      status: "error",
      error: `Failed to parse angr output: ${err instanceof Error ? err.message : String(err)}`,
      functions: [],
    };
  }
}

export async function runAngrWorker(
  opts: AngrRunnerOptions,
): Promise<AngrExtractedData> {
  const args = buildAngrArgs(opts);
  const command = args[0];
  const commandArgs = args.slice(1);

  return new Promise((resolve) => {
    execFile(command, commandArgs, { timeout: opts.timeoutMs }, (err) => {
      if (err) {
        resolve({
          status: "error",
          error: `angr worker failed: ${err.message}`,
          functions: [],
        });
        return;
      }

      try {
        const output = readFileSync(opts.outputPath, "utf-8");
        resolve(parseAngrOutput(output));
      } catch (readErr) {
        resolve({
          status: "error",
          error: `Failed to read output: ${readErr instanceof Error ? readErr.message : String(readErr)}`,
          functions: [],
        });
      }
    });
  });
}
