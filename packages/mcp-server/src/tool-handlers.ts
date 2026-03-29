import type { CanonicalFunction } from "@genai-decompiler/core-contracts";

export interface AnalyzeBinaryResult {
  binaryHash: string;
  workspacePath: string;
  summary: string;
  totalFunctions: number;
}

export interface ToolContext {
  analyzeBinary: (opts: { binaryPath: string }) => Promise<AnalyzeBinaryResult>;
  listFunctions: (opts: { binaryHash: string }) => Promise<CanonicalFunction[]>;
  getFunction: (id: string) => Promise<CanonicalFunction | null>;
}

export async function handleAnalyzeBinary(
  input: { binaryPath: string },
  ctx: ToolContext,
): Promise<AnalyzeBinaryResult> {
  return ctx.analyzeBinary({ binaryPath: input.binaryPath });
}

export async function handleListFunctions(
  input: { binaryHash: string },
  ctx: ToolContext,
): Promise<CanonicalFunction[]> {
  return ctx.listFunctions({ binaryHash: input.binaryHash });
}

export async function handleGetFunction(
  input: { functionId: string },
  ctx: ToolContext,
): Promise<CanonicalFunction | null> {
  return ctx.getFunction(input.functionId);
}
