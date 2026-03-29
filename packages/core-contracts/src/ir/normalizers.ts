import type { CanonicalFunction } from "./canonical.js";
import type { GhidraExtractedData } from "@genai-decompiler/ghidra-adapter";
import type { AngrExtractedData } from "@genai-decompiler/angr-adapter";

const DEFAULT_CONFIDENCE = 0.6;

const defaultSemantics = () => ({
  purpose: null,
  sideEffects: [],
  purity: "unknown" as const,
});

function archFromString(arch: string): CanonicalFunction["arch"] {
  const normalized = arch.toLowerCase();
  if (normalized.includes("x86_64") || normalized.includes("amd64") || normalized === "x86:le:64:default") return "x86_64";
  if (normalized.includes("arm64") || normalized.includes("aarch64")) return "arm64";
  if (normalized.includes("armv7") || normalized.includes("arm")) return "armv7";
  return "x86";
}

export function normalizeGhidra(
  data: GhidraExtractedData,
  binaryHash: string,
): CanonicalFunction[] {
  if (data.status !== "success" || !data.functions) return [];

  const arch = archFromString(data.binary?.arch ?? "x86_64");

  return data.functions.map((fn, idx) => ({
    id: `ghidra_${fn.address}_${idx}`,
    binaryHash,
    backendSources: ["ghidra"],
    arch,
    address: fn.address,
    rawName: fn.name,
    confidence: DEFAULT_CONFIDENCE,
    blocks: [],
    edges: [],
    variables: [],
    calls: [],
    strings: (data.strings ?? []).map((s) => ({
      address: s.address,
      value: s.value,
      confidence: DEFAULT_CONFIDENCE,
    })),
    imports: (data.imports ?? []).map((i) => ({
      name: i.name,
      library: i.library,
      address: i.address,
      confidence: DEFAULT_CONFIDENCE,
    })),
    typeHints: [],
    semantics: defaultSemantics(),
    diagnostics: [],
  }));
}

export function normalizeAngr(
  data: AngrExtractedData,
  binaryHash: string,
): CanonicalFunction[] {
  if (data.status !== "success" || !data.functions) return [];

  const arch = archFromString(data.binary?.arch ?? "x86_64");

  return data.functions.map((fn, idx) => ({
    id: `angr_${fn.address}_${idx}`,
    binaryHash,
    backendSources: ["angr"],
    arch,
    address: fn.address,
    rawName: fn.name,
    confidence: DEFAULT_CONFIDENCE,
    blocks: fn.blocks.map((b) => ({
      id: `block_${b.address}`,
      address: b.address,
      instructions: b.instructions.map((instr, i) => ({
        address: `${b.address}+${i}`,
        mnemonic: instr.split(" ")[0] ?? instr,
        operands: instr.split(" ").slice(1).join(" "),
      })),
      confidence: DEFAULT_CONFIDENCE,
    })),
    edges: fn.edges.map((e) => ({
      from: `block_${e.from}`,
      to: `block_${e.to}`,
      type: mapEdgeType(e.type),
      confidence: DEFAULT_CONFIDENCE,
    })),
    variables: [],
    calls: [],
    strings: [],
    imports: [],
    typeHints: [],
    semantics: defaultSemantics(),
    diagnostics: [],
  }));
}

function mapEdgeType(
  type: string,
): "fallthrough" | "conditional_true" | "conditional_false" | "unconditional" | "call" | "return" {
  switch (type) {
    case "fallthrough":
      return "fallthrough";
    case "conditional_true":
      return "conditional_true";
    case "conditional_false":
      return "conditional_false";
    case "call":
      return "call";
    case "return":
      return "return";
    default:
      return "unconditional";
  }
}

export function computeConvergence(
  ghidraFns: CanonicalFunction[],
  angrFns: CanonicalFunction[],
): number {
  if (ghidraFns.length === 0 || angrFns.length === 0) return 0;

  const ghidraAddresses = new Set(ghidraFns.map((f) => f.address));
  const angrAddresses = new Set(angrFns.map((f) => f.address));

  let overlap = 0;
  for (const addr of ghidraAddresses) {
    if (angrAddresses.has(addr)) overlap++;
  }

  const union = new Set([...ghidraAddresses, ...angrAddresses]).size;
  return union > 0 ? overlap / union : 0;
}
