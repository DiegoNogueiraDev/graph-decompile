import type { CanonicalFunction } from "@genai-decompiler/core-contracts";

export interface BinaryReportInput {
  binaryHash: string;
  binaryName: string;
  arch: string;
  functions: CanonicalFunction[];
  convergenceScore: number;
}

export interface FunctionReportInput {
  fn: CanonicalFunction;
  pseudocode?: string;
  hypotheses: { id: string; type: string; value: string; confidence: number; accepted: boolean }[];
}

export function generateBinaryReport(input: BinaryReportInput, format: "markdown" | "json"): string {
  if (format === "json") {
    return JSON.stringify({
      binaryHash: input.binaryHash,
      binaryName: input.binaryName,
      arch: input.arch,
      functionCount: input.functions.length,
      convergenceScore: input.convergenceScore,
      functions: input.functions.map((f) => ({
        id: f.id,
        address: f.address,
        name: f.rawName ?? f.id,
        confidence: f.confidence,
      })),
      imports: input.functions.flatMap((f) => f.imports.map((i) => i.name)),
    }, null, 2);
  }

  const imports = [...new Set(input.functions.flatMap((f) => f.imports.map((i) => i.name)))];

  const lines = [
    `# Binary Analysis Report`,
    ``,
    `| Field | Value |`,
    `|-------|-------|`,
    `| Name | ${input.binaryName} |`,
    `| Hash | ${input.binaryHash} |`,
    `| Arch | ${input.arch} |`,
    `| Functions | ${input.functions.length} |`,
    `| Convergence | ${(input.convergenceScore * 100).toFixed(1)}% |`,
    ``,
    `## Top Functions`,
    ``,
    `| Address | Name | Confidence |`,
    `|---------|------|------------|`,
    ...input.functions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 20)
      .map((f) => `| ${f.address} | ${f.rawName ?? f.id} | ${f.confidence.toFixed(2)} |`),
    ``,
    `## Imports`,
    ``,
    ...imports.map((i) => `- ${i}`),
  ];

  return lines.join("\n");
}

export function generateFunctionReport(input: FunctionReportInput, format: "markdown" | "json"): string {
  if (format === "json") {
    return JSON.stringify({
      function: {
        id: input.fn.id,
        address: input.fn.address,
        name: input.fn.rawName ?? input.fn.id,
        arch: input.fn.arch,
        confidence: input.fn.confidence,
        blockCount: input.fn.blocks.length,
        edgeCount: input.fn.edges.length,
      },
      pseudocode: input.pseudocode ?? null,
      hypotheses: input.hypotheses,
    }, null, 2);
  }

  const lines = [
    `# Function: ${input.fn.rawName ?? input.fn.id}`,
    ``,
    `| Field | Value |`,
    `|-------|-------|`,
    `| Address | ${input.fn.address} |`,
    `| Arch | ${input.fn.arch} |`,
    `| Confidence | ${input.fn.confidence.toFixed(2)} |`,
    `| Blocks | ${input.fn.blocks.length} |`,
    `| Edges | ${input.fn.edges.length} |`,
    ``,
  ];

  if (input.pseudocode) {
    lines.push(`## pseudocode`, ``, "```c", input.pseudocode, "```", ``);
  }

  if (input.hypotheses.length > 0) {
    lines.push(
      `## Hypotheses`,
      ``,
      `| Type | Value | Confidence | Accepted |`,
      `|------|-------|------------|----------|`,
      ...input.hypotheses.map(
        (h) => `| ${h.type} | ${h.value} | ${h.confidence.toFixed(2)} | ${h.accepted ? "Yes" : "No"} |`,
      ),
    );
  }

  return lines.join("\n");
}
