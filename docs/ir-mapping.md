# IR Canonical v0 — Ghidra / angr Field Mapping

## Common Fields (IR v0 Core)

| IR Field | Ghidra Source | angr Source | Notes |
|----------|--------------|-------------|-------|
| `id` | Generated | Generated | `{backend}_{address}_{idx}` |
| `binaryHash` | Caller provides | Caller provides | SHA-256 of binary |
| `backendSources` | `["ghidra"]` | `["angr"]` | Array for multi-backend |
| `arch` | `program.language.processor` | `project.arch.name` | Normalized to enum |
| `address` | `function.entryPoint` | `func_addr` (hex) | String hex address |
| `rawName` | `function.name` | `func.name` | Original symbol name |
| `confidence` | Default 0.6 | Default 0.6 | Adjustable per field |
| `blocks` | Not in v0 (Ghidra) | `func.blocks` | angr provides CFG blocks |
| `edges` | Not in v0 (Ghidra) | CFG successors | angr provides CFG edges |
| `strings` | `data.hasStringValue()` | Not in v0 (angr) | Ghidra extracts strings |
| `imports` | `externalManager` | Not in v0 (angr) | Ghidra extracts imports |
| `calls` | Not in v0 | Not in v0 | Future: call graph |
| `variables` | Not in v0 | Not in v0 | Future: stack/register vars |
| `typeHints` | Not in v0 | Not in v0 | Future: GenAI layer |

## Backend-Specific Metadata (Optional)

Backend-specific data that doesn't map to the canonical IR is stored in the optional `backendMetadata` field:

```typescript
backendMetadata?: Record<string, unknown>
```

### Ghidra Metadata Examples
- `decompilerVersion` — Ghidra version used
- `analysisTime` — Time in seconds for autoanalysis
- `pseudocodeRaw` — Raw Ghidra decompiler output

### angr Metadata Examples
- `ailText` — AIL (lifted IR) per function
- `cfgType` — CFGFast vs CFGEmulated
- `analysisTime` — Time for CFG generation

## Convergence Strategy

When both backends provide data for the same function (matched by address):
1. Blocks/edges come from angr (richer CFG)
2. Strings/imports come from Ghidra (better extraction)
3. Names: prefer non-auto-generated names from either backend
4. Convergence score = Jaccard index of function addresses

## Expansion Plan (v1+)

| Version | Fields Added | Source |
|---------|-------------|--------|
| v0 | Core fields above | Both |
| v1 | `calls`, `variables` | Ghidra + angr |
| v2 | `typeHints`, `pseudocode` | GenAI layer |
| v3 | `semantics` (populated) | GenAI + validation |
