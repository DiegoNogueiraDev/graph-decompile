import { z } from "zod";
import type { CanonicalFunction } from "@genai-decompiler/core-contracts";

type FunctionContext = Pick<CanonicalFunction, "id" | "address" | "rawName" | "arch" | "blocks" | "calls" | "strings" | "imports">;

function serializeContext(fn: FunctionContext): string {
  return JSON.stringify({
    address: fn.address,
    rawName: fn.rawName,
    arch: fn.arch,
    blockCount: fn.blocks.length,
    calls: fn.calls.map((c) => c.targetName).filter(Boolean),
    strings: fn.strings.map((s) => s.value),
    imports: fn.imports.map((i) => i.name),
  }, null, 2);
}

// ── Explain ──────────────────────────────────────────────────────────────────

export const ExplainOutputSchema = z.object({
  purpose: z.string(),
  sideEffects: z.array(z.string()),
  complexity: z.enum(["low", "medium", "high"]),
  confidence: z.number().min(0).max(1),
});

export type ExplainOutput = z.infer<typeof ExplainOutputSchema>;

export function buildExplainPrompt(fn: FunctionContext): string {
  return `You are a binary analysis expert. Analyze this decompiled function and explain its purpose.

## Function Context
${serializeContext(fn)}

## Instructions
Respond with a JSON object matching this schema:
- purpose: string — one-sentence description of what the function does
- sideEffects: string[] — list of observable side effects (I/O, memory, global state)
- complexity: "low" | "medium" | "high"
- confidence: number 0-1 — how confident you are in this analysis

Respond ONLY with valid JSON, no markdown or explanation.`;
}

// ── Rename ───────────────────────────────────────────────────────────────────

export const RenameOutputSchema = z.object({
  suggestions: z.array(z.object({
    name: z.string(),
    confidence: z.number().min(0).max(1),
    evidence: z.string(),
  })),
});

export type RenameOutput = z.infer<typeof RenameOutputSchema>;

export function buildRenamePrompt(fn: FunctionContext): string {
  return `You are a binary analysis expert. Suggest meaningful names for this function currently named "${fn.rawName ?? "unknown"}".

## Function Context
${serializeContext(fn)}

## Instructions
Respond with a JSON object matching this schema:
- suggestions: array of { name: string, confidence: number 0-1, evidence: string }

Provide 2-5 name suggestions ranked by confidence. Each must include evidence from the function context.
Respond ONLY with valid JSON, no markdown or explanation.`;
}

// ── Type Inference ───────────────────────────────────────────────────────────

export const TypeInferenceOutputSchema = z.object({
  inferences: z.array(z.object({
    targetId: z.string(),
    suggestedType: z.string(),
    confidence: z.number().min(0).max(1),
    reasoning: z.string(),
  })),
});

export type TypeInferenceOutput = z.infer<typeof TypeInferenceOutputSchema>;

export function buildTypeInferencePrompt(fn: FunctionContext): string {
  return `You are a binary analysis expert specializing in type recovery. Infer types for variables and parameters in this function.

## Function Context
${serializeContext(fn)}

## Instructions
Respond with a JSON object matching this schema:
- inferences: array of { targetId: string, suggestedType: string, confidence: number 0-1, reasoning: string }

Use C/C++ type notation. Include reasoning based on how values are used (passed to APIs, arithmetic, comparisons).
Respond ONLY with valid JSON, no markdown or explanation.`;
}

// ── Diff Summary ─────────────────────────────────────────────────────────────

export const DiffSummaryOutputSchema = z.object({
  summary: z.string(),
  changes: z.array(z.string()),
  severity: z.enum(["low", "medium", "high", "critical"]),
  confidence: z.number().min(0).max(1),
});

export type DiffSummaryOutput = z.infer<typeof DiffSummaryOutputSchema>;

export function buildDiffSummaryPrompt(oldIr: string, newIr: string): string {
  return `You are a binary analysis expert. Compare these two versions of a function's IR and summarize the differences.

## Old Version
${oldIr}

## New Version
${newIr}

## Instructions
Respond with a JSON object matching this schema:
- summary: string — one-sentence summary of what changed
- changes: string[] — list of specific changes
- severity: "low" | "medium" | "high" | "critical"
- confidence: number 0-1

Respond ONLY with valid JSON, no markdown or explanation.`;
}
