import { hashBinary, createWorkspace } from "@genai-decompiler/storage";
import { analyzeBinary } from "@genai-decompiler/orchestration";
import type { GhidraExtractedData } from "@genai-decompiler/ghidra-adapter";
import type { AngrExtractedData } from "@genai-decompiler/angr-adapter";

export interface AnalyzeCommandOptions {
  binaryPath: string;
  workspaceBase: string;
  runGhidra: () => Promise<GhidraExtractedData>;
  runAngr: () => Promise<AngrExtractedData>;
}

export interface AnalyzeCommandResult {
  binaryHash: string;
  workspacePath: string;
  summary: string;
  totalFunctions: number;
}

export async function runAnalyzeCommand(opts: AnalyzeCommandOptions): Promise<AnalyzeCommandResult> {
  const binaryHash = await hashBinary(opts.binaryPath);
  const workspacePath = createWorkspace(opts.workspaceBase, binaryHash);

  const result = await analyzeBinary({
    binaryHash,
    runGhidra: opts.runGhidra,
    runAngr: opts.runAngr,
  });

  const totalFunctions = new Set([
    ...result.ghidraFunctions.map((f) => f.address),
    ...result.angrFunctions.map((f) => f.address),
  ]).size;

  return {
    binaryHash,
    workspacePath,
    summary: result.summary,
    totalFunctions,
  };
}
