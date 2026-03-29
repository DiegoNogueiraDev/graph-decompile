export interface ExplainResult {
  purpose: string;
  sideEffects: string[];
  complexity: "low" | "medium" | "high";
  confidence: number;
  confidenceSource: "deterministic" | "genai";
}

export interface DecompileResult {
  pseudocode: string;
  confidence: number;
  confidenceSource: "deterministic" | "genai";
}

export interface GenAiToolContext {
  explainFunction: (functionId: string) => Promise<ExplainResult>;
  decompileFunction: (functionId: string) => Promise<DecompileResult>;
}

export async function handleExplainFunction(
  input: { functionId: string },
  ctx: GenAiToolContext,
): Promise<ExplainResult> {
  return ctx.explainFunction(input.functionId);
}

export async function handleDecompileFunction(
  input: { functionId: string },
  ctx: GenAiToolContext,
): Promise<DecompileResult> {
  return ctx.decompileFunction(input.functionId);
}
