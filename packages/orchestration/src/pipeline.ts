import type { CanonicalFunction } from "@genai-decompiler/core-contracts";
import { normalizeGhidra, normalizeAngr, computeConvergence } from "@genai-decompiler/core-contracts";
import type { GhidraExtractedData } from "@genai-decompiler/ghidra-adapter";
import type { AngrExtractedData } from "@genai-decompiler/angr-adapter";

export interface AnalyzePipelineOptions {
  binaryHash: string;
  runGhidra: () => Promise<GhidraExtractedData>;
  runAngr: () => Promise<AngrExtractedData>;
}

export interface AnalyzeResult {
  ghidraFunctions: CanonicalFunction[];
  angrFunctions: CanonicalFunction[];
  convergenceScore: number;
  summary: string;
}

export async function analyzeBinary(opts: AnalyzePipelineOptions): Promise<AnalyzeResult> {
  const [ghidraData, angrData] = await Promise.all([
    opts.runGhidra(),
    opts.runAngr(),
  ]);

  const ghidraFunctions = normalizeGhidra(ghidraData, opts.binaryHash);
  const angrFunctions = normalizeAngr(angrData, opts.binaryHash);
  const convergenceScore = computeConvergence(ghidraFunctions, angrFunctions);

  const totalFunctions = new Set([
    ...ghidraFunctions.map((f) => f.address),
    ...angrFunctions.map((f) => f.address),
  ]).size;

  const summary = [
    `Analysis complete: ${totalFunctions} function(s) discovered`,
    `  Ghidra: ${ghidraFunctions.length} function(s)`,
    `  angr:   ${angrFunctions.length} function(s)`,
    `  Convergence: ${(convergenceScore * 100).toFixed(1)}%`,
  ].join("\n");

  return {
    ghidraFunctions,
    angrFunctions,
    convergenceScore,
    summary,
  };
}
