import { z } from "zod";

/** Confidence score: 0 (no confidence) to 1 (full confidence) */
const confidence = z.number().min(0).max(1);

// ── Instruction ──────────────────────────────────────────────────────────────

export const CanonicalInstructionSchema = z.object({
  address: z.string(),
  mnemonic: z.string(),
  operands: z.string(),
  raw: z.string().optional(),
});

export type CanonicalInstruction = z.infer<typeof CanonicalInstructionSchema>;

// ── Block ────────────────────────────────────────────────────────────────────

export const CanonicalBlockSchema = z.object({
  id: z.string(),
  address: z.string(),
  instructions: z.array(CanonicalInstructionSchema),
  confidence,
});

export type CanonicalBlock = z.infer<typeof CanonicalBlockSchema>;

// ── Edge ─────────────────────────────────────────────────────────────────────

export const CanonicalEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  type: z.enum(["fallthrough", "conditional_true", "conditional_false", "unconditional", "call", "return"]),
  confidence,
});

export type CanonicalEdge = z.infer<typeof CanonicalEdgeSchema>;

// ── Variable ─────────────────────────────────────────────────────────────────

export const CanonicalVariableSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  type: z.string().optional(),
  scope: z.enum(["local", "parameter", "global", "register"]),
  confidence,
});

export type CanonicalVariable = z.infer<typeof CanonicalVariableSchema>;

// ── Call Site ─────────────────────────────────────────────────────────────────

export const CanonicalCallSiteSchema = z.object({
  address: z.string(),
  targetName: z.string().optional(),
  targetAddress: z.string().optional(),
  confidence,
});

export type CanonicalCallSite = z.infer<typeof CanonicalCallSiteSchema>;

// ── String Ref ───────────────────────────────────────────────────────────────

export const CanonicalStringRefSchema = z.object({
  address: z.string(),
  value: z.string(),
  confidence,
});

export type CanonicalStringRef = z.infer<typeof CanonicalStringRefSchema>;

// ── Import Ref ───────────────────────────────────────────────────────────────

export const CanonicalImportRefSchema = z.object({
  name: z.string(),
  library: z.string().optional(),
  address: z.string().optional(),
  confidence,
});

export type CanonicalImportRef = z.infer<typeof CanonicalImportRefSchema>;

// ── Type Hint ────────────────────────────────────────────────────────────────

export const CanonicalTypeHintSchema = z.object({
  targetId: z.string(),
  suggestedType: z.string(),
  source: z.string(),
  confidence,
});

export type CanonicalTypeHint = z.infer<typeof CanonicalTypeHintSchema>;

// ── Semantic Facts ───────────────────────────────────────────────────────────

export const CanonicalSemanticFactsSchema = z.object({
  purpose: z.string().nullable(),
  sideEffects: z.array(z.string()),
  purity: z.enum(["pure", "impure", "unknown"]),
});

export type CanonicalSemanticFacts = z.infer<typeof CanonicalSemanticFactsSchema>;

// ── Diagnostic ───────────────────────────────────────────────────────────────

export const CanonicalDiagnosticSchema = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(["info", "warning", "error"]),
});

export type CanonicalDiagnostic = z.infer<typeof CanonicalDiagnosticSchema>;

// ── Function (top-level) ─────────────────────────────────────────────────────

export const CanonicalFunctionSchema = z.object({
  id: z.string(),
  binaryHash: z.string(),
  backendSources: z.array(z.string()),
  arch: z.enum(["x86_64", "x86", "arm64", "armv7"]),
  address: z.string(),
  rawName: z.string().optional(),
  normalizedName: z.string().optional(),
  confidence,
  blocks: z.array(CanonicalBlockSchema),
  edges: z.array(CanonicalEdgeSchema),
  variables: z.array(CanonicalVariableSchema),
  calls: z.array(CanonicalCallSiteSchema),
  strings: z.array(CanonicalStringRefSchema),
  imports: z.array(CanonicalImportRefSchema),
  typeHints: z.array(CanonicalTypeHintSchema),
  pseudocode: z.string().optional(),
  semantics: CanonicalSemanticFactsSchema,
  diagnostics: z.array(CanonicalDiagnosticSchema),
  backendMetadata: z.record(z.string(), z.unknown()).optional(),
});

export type CanonicalFunction = z.infer<typeof CanonicalFunctionSchema>;
