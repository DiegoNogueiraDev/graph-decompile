import type { CanonicalFunction } from "@genai-decompiler/core-contracts";
import type { ValidationResult } from "./types.js";

const HEX_ADDRESS = /^0x[0-9a-fA-F]+$/;

export function validateEdgeConsistency(fn: CanonicalFunction): ValidationResult {
  const blockIds = new Set(fn.blocks.map((b) => b.id));
  const errors: ValidationResult["errors"] = [];

  for (const edge of fn.edges) {
    if (!blockIds.has(edge.from)) {
      errors.push({
        code: "EDGE_INVALID_SOURCE",
        message: `Edge source "${edge.from}" does not reference an existing block`,
        path: `edges[${edge.from}->${edge.to}]`,
      });
    }
    if (!blockIds.has(edge.to)) {
      errors.push({
        code: "EDGE_INVALID_TARGET",
        message: `Edge target "${edge.to}" does not reference an existing block`,
        path: `edges[${edge.from}->${edge.to}]`,
      });
    }
  }

  return { valid: errors.length === 0, errors, warnings: [] };
}

export function validateAddressFormat(fn: CanonicalFunction): ValidationResult {
  const errors: ValidationResult["errors"] = [];

  if (!HEX_ADDRESS.test(fn.address)) {
    errors.push({
      code: "INVALID_ADDRESS",
      message: `Function address "${fn.address}" is not valid hex format`,
      path: "address",
    });
  }

  for (let i = 0; i < fn.blocks.length; i++) {
    const block = fn.blocks[i];
    if (!HEX_ADDRESS.test(block.address)) {
      errors.push({
        code: "INVALID_ADDRESS",
        message: `Block "${block.id}" address "${block.address}" is not valid hex format`,
        path: `blocks[${i}].address`,
      });
    }
  }

  return { valid: errors.length === 0, errors, warnings: [] };
}

export function validateBlockReachability(fn: CanonicalFunction): ValidationResult {
  const warnings: ValidationResult["warnings"] = [];

  if (fn.blocks.length <= 1) {
    return { valid: true, errors: [], warnings };
  }

  const reachable = new Set<string>();
  const entryBlock = fn.blocks[0].id;
  const adjacency = new Map<string, string[]>();

  for (const edge of fn.edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from)!.push(edge.to);
  }

  const stack = [entryBlock];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (reachable.has(current)) continue;
    reachable.add(current);
    for (const neighbor of adjacency.get(current) ?? []) {
      if (!reachable.has(neighbor)) stack.push(neighbor);
    }
  }

  for (const block of fn.blocks) {
    if (!reachable.has(block.id)) {
      warnings.push({
        code: "UNREACHABLE_BLOCK",
        message: `Block "${block.id}" at ${block.address} is not reachable from entry block`,
        path: `blocks[${block.id}]`,
      });
    }
  }

  return { valid: true, errors: [], warnings };
}
