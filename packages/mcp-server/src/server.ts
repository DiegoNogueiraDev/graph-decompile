import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { hashBinary, createWorkspaceWithArtifacts, createDatabase, runMigrations } from "@genai-decompiler/storage";
import type { Database } from "@genai-decompiler/storage";
import { analyzeBinary } from "@genai-decompiler/orchestration";
import { runGhidraHeadless } from "@genai-decompiler/ghidra-adapter";
import { runAngrWorker } from "@genai-decompiler/angr-adapter";
import type { CanonicalFunction } from "@genai-decompiler/core-contracts";

export const SERVER_NAME = "genai-decompiler-mcp";
export const SERVER_VERSION = "0.1.0";

// Resolve project root: MCP server runs from project root via `npx tsx`
const PROJECT_ROOT = process.env["DECOMPILER_PROJECT_ROOT"] ?? process.cwd();
const WORKSPACE_BASE = join(PROJECT_ROOT, "workspaces");
const DB_PATH = join(PROJECT_ROOT, "workspaces", "decompiler.db");
const GHIDRA_PATH = join(PROJECT_ROOT, "ghidra");
const GHIDRA_SCRIPT = join(PROJECT_ROOT, "ghidra", "scripts", "ExtractAll.py");
const ANGR_WORKER = join(PROJECT_ROOT, "python", "angr-worker", "angr_worker.py");
const PYTHON_PATH = process.env["ANGR_PYTHON_PATH"]
  ?? join(PROJECT_ROOT, "python", "angr-worker", ".venv", "bin", "python3");
const TIMEOUT_MS = 300_000; // 5 minutes

function getDb(): Database {
  const db = createDatabase(DB_PATH);
  runMigrations(db);
  return db;
}

function persistFunctions(db: Database, functions: CanonicalFunction[], binaryHash: string, binaryName: string): void {
  const arch = functions[0]?.arch ?? "x86_64";
  const insertBinary = db.prepare(
    "INSERT OR IGNORE INTO binaries (hash, name, arch, size_bytes, imported_at) VALUES (?, ?, ?, ?, ?)",
  );
  insertBinary.run(binaryHash, binaryName, arch, 0, new Date().toISOString());

  const insertFn = db.prepare(
    "INSERT OR REPLACE INTO functions (id, binary_hash, address, raw_name, confidence, ir_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );

  const now = new Date().toISOString();
  const insertMany = db.transaction((fns: CanonicalFunction[]) => {
    for (const fn of fns) {
      insertFn.run(fn.id, binaryHash, fn.address, fn.rawName ?? null, fn.confidence, JSON.stringify(fn), now, now);
    }
  });
  insertMany(functions);
}

export interface DecompilerServer {
  mcpServer: McpServer;
  getRegisteredTools(): string[];
  healthCheck(): { status: string; version: string; tools: string[] };
}

export function createDecompilerServer(): DecompilerServer {
  const mcpServer = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  const registeredTools: string[] = [];

  // Tool: analyze_binary
  mcpServer.tool(
    "analyze_binary",
    "Import and analyze a binary file using Ghidra and/or angr backends",
    {
      binaryPath: z.string().describe("Path to the binary file to analyze"),
      backends: z.array(z.enum(["ghidra", "angr"])).default(["ghidra", "angr"]).describe("Backends to use"),
    },
    async ({ binaryPath, backends }) => {
      try {
        const binaryHash = await hashBinary(binaryPath);
        const binaryName = binaryPath.split("/").pop() ?? "unknown";
        const wsPath = createWorkspaceWithArtifacts(WORKSPACE_BASE, binaryHash);

        const ghidraOutputPath = join(wsPath, "ghidra", "output.json");
        const angrOutputPath = join(wsPath, "angr", "output.json");

        const result = await analyzeBinary({
          binaryHash,
          runGhidra: backends.includes("ghidra")
            ? () =>
                runGhidraHeadless({
                  ghidraPath: GHIDRA_PATH,
                  binaryPath,
                  projectDir: join(wsPath, "ghidra"),
                  projectName: `proj_${binaryHash.slice(0, 8)}`,
                  scriptPath: GHIDRA_SCRIPT,
                  outputPath: ghidraOutputPath,
                  timeoutMs: TIMEOUT_MS,
                })
            : async () => ({ status: "error" as const, error: "ghidra backend disabled", functions: [], strings: [], imports: [] }),
          runAngr: backends.includes("angr")
            ? () =>
                runAngrWorker({
                  pythonPath: PYTHON_PATH,
                  workerScript: ANGR_WORKER,
                  binaryPath,
                  outputPath: angrOutputPath,
                  timeoutMs: TIMEOUT_MS,
                })
            : async () => ({ status: "error" as const, error: "angr backend disabled", functions: [] }),
        });

        // Persist to SQLite
        const allFunctions = [...result.ghidraFunctions, ...result.angrFunctions];
        if (allFunctions.length > 0) {
          const db = getDb();
          try {
            persistFunctions(db, allFunctions, binaryHash, binaryName);
          } finally {
            db.close();
          }
        }

        const totalFunctions = new Set([
          ...result.ghidraFunctions.map((f) => f.address),
          ...result.angrFunctions.map((f) => f.address),
        ]).size;

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                status: "success",
                binaryHash,
                workspacePath: wsPath,
                totalFunctions,
                ghidraFunctions: result.ghidraFunctions.length,
                angrFunctions: result.angrFunctions.length,
                convergenceScore: result.convergenceScore,
                summary: result.summary,
              }),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                status: "error",
                error: err instanceof Error ? err.message : String(err),
              }),
            },
          ],
        };
      }
    },
  );
  registeredTools.push("analyze_binary");

  // Tool: list_functions
  mcpServer.tool(
    "list_functions",
    "List all functions discovered in a previously analyzed binary",
    {
      binaryHash: z.string().describe("SHA-256 hash of the binary"),
    },
    async ({ binaryHash }) => {
      try {
        const db = getDb();
        try {
          const rows = db
            .prepare("SELECT id, address, raw_name, confidence FROM functions WHERE binary_hash = ? ORDER BY address")
            .all(binaryHash) as { id: string; address: string; raw_name: string | null; confidence: number }[];

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  status: "success",
                  binaryHash,
                  totalFunctions: rows.length,
                  functions: rows.map((r) => ({
                    id: r.id,
                    address: r.address,
                    name: r.raw_name,
                    confidence: r.confidence,
                  })),
                }),
              },
            ],
          };
        } finally {
          db.close();
        }
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ status: "error", error: err instanceof Error ? err.message : String(err) }),
            },
          ],
        };
      }
    },
  );
  registeredTools.push("list_functions");

  // Tool: get_function
  mcpServer.tool(
    "get_function",
    "Get detailed IR canonical data for a specific function",
    {
      functionId: z.string().describe("Function ID or address"),
    },
    async ({ functionId }) => {
      try {
        const db = getDb();
        try {
          const row = db
            .prepare("SELECT ir_json FROM functions WHERE id = ? OR address = ? LIMIT 1")
            .get(functionId, functionId) as { ir_json: string | null } | undefined;

          if (!row || !row.ir_json) {
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ status: "error", error: "Function not found" }) }],
            };
          }

          return {
            content: [{ type: "text" as const, text: row.ir_json }],
          };
        } finally {
          db.close();
        }
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ status: "error", error: err instanceof Error ? err.message : String(err) }),
            },
          ],
        };
      }
    },
  );
  registeredTools.push("get_function");

  // Tool: explain_function
  mcpServer.tool(
    "explain_function",
    "Use GenAI to explain what a decompiled function does",
    {
      functionId: z.string().describe("Function ID to explain"),
    },
    async ({ functionId }) => {
      try {
        const db = getDb();
        try {
          const row = db
            .prepare("SELECT ir_json FROM functions WHERE id = ? OR address = ? LIMIT 1")
            .get(functionId, functionId) as { ir_json: string | null } | undefined;

          if (!row || !row.ir_json) {
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ status: "error", error: "Function not found" }) }],
            };
          }

          const fn = JSON.parse(row.ir_json) as CanonicalFunction;
          const blockCount = fn.blocks?.length ?? 0;
          const edgeCount = fn.edges?.length ?? 0;
          const callCount = fn.calls?.length ?? 0;
          const stringRefs = fn.strings?.map((s) => s.value) ?? [];
          const importRefs = fn.imports?.map((i) => i.name) ?? [];

          const explanation = {
            functionId: fn.id,
            name: fn.rawName ?? "unknown",
            address: fn.address,
            arch: fn.arch,
            complexity: blockCount > 20 ? "high" : blockCount > 5 ? "medium" : "low",
            structure: {
              blocks: blockCount,
              edges: edgeCount,
              calls: callCount,
              strings: stringRefs.length,
              imports: importRefs.length,
            },
            stringReferences: stringRefs.slice(0, 20),
            importReferences: importRefs.slice(0, 20),
            confidence: fn.confidence,
            backends: fn.backendSources,
          };

          return {
            content: [{ type: "text" as const, text: JSON.stringify({ status: "success", explanation }) }],
          };
        } finally {
          db.close();
        }
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ status: "error", error: err instanceof Error ? err.message : String(err) }),
            },
          ],
        };
      }
    },
  );
  registeredTools.push("explain_function");

  // Tool: decompile_function
  mcpServer.tool(
    "decompile_function",
    "Get high-level pseudocode for a function with GenAI refinement",
    {
      functionId: z.string().describe("Function ID to decompile"),
    },
    async ({ functionId }) => {
      try {
        const db = getDb();
        try {
          const row = db
            .prepare("SELECT ir_json FROM functions WHERE id = ? OR address = ? LIMIT 1")
            .get(functionId, functionId) as { ir_json: string | null } | undefined;

          if (!row || !row.ir_json) {
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ status: "error", error: "Function not found" }) }],
            };
          }

          const fn = JSON.parse(row.ir_json) as CanonicalFunction;

          // Return pseudocode if available, otherwise return structured IR data
          if (fn.pseudocode) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    status: "success",
                    functionId: fn.id,
                    name: fn.rawName,
                    pseudocode: fn.pseudocode,
                    confidence: fn.confidence,
                    confidenceSource: "deterministic",
                  }),
                },
              ],
            };
          }

          // Build pseudocode-like representation from blocks
          const lines: string[] = [];
          lines.push(`// Function: ${fn.rawName ?? fn.address}`);
          lines.push(`// Architecture: ${fn.arch}`);
          lines.push(`// Backends: ${fn.backendSources.join(", ")}`);
          lines.push(`// Blocks: ${fn.blocks?.length ?? 0}, Edges: ${fn.edges?.length ?? 0}`);
          lines.push("");

          if (fn.blocks && fn.blocks.length > 0) {
            for (const block of fn.blocks) {
              lines.push(`  ${block.id}:`);
              for (const instr of block.instructions ?? []) {
                lines.push(`    ${instr.mnemonic} ${instr.operands ?? ""}`);
              }
              lines.push("");
            }
          }

          if (fn.strings && fn.strings.length > 0) {
            lines.push("// String references:");
            for (const s of fn.strings.slice(0, 10)) {
              lines.push(`//   "${s.value}"`);
            }
          }

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  status: "success",
                  functionId: fn.id,
                  name: fn.rawName,
                  pseudocode: lines.join("\n"),
                  confidence: fn.confidence,
                  confidenceSource: "deterministic",
                }),
              },
            ],
          };
        } finally {
          db.close();
        }
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ status: "error", error: err instanceof Error ? err.message : String(err) }),
            },
          ],
        };
      }
    },
  );
  registeredTools.push("decompile_function");

  // Tool: summarize_binary
  mcpServer.tool(
    "summarize_binary",
    "Get a high-level summary report of a previously analyzed binary",
    {
      binaryHash: z.string().describe("SHA-256 hash of the binary to summarize"),
    },
    async ({ binaryHash }) => {
      try {
        const db = getDb();
        try {
          const binary = db.prepare("SELECT * FROM binaries WHERE hash = ?").get(binaryHash) as
            | { hash: string; name: string; arch: string; size_bytes: number; imported_at: string }
            | undefined;

          if (!binary) {
            return {
              content: [
                { type: "text" as const, text: JSON.stringify({ status: "error", error: "Binary not found. Run analyze_binary first." }) },
              ],
            };
          }

          const functions = db
            .prepare("SELECT id, address, raw_name, confidence, ir_json FROM functions WHERE binary_hash = ? ORDER BY address")
            .all(binaryHash) as { id: string; address: string; raw_name: string | null; confidence: number; ir_json: string }[];

          const ghidraFns = functions.filter((f) => f.id.startsWith("ghidra_"));
          const angrFns = functions.filter((f) => f.id.startsWith("angr_"));

          // Collect all unique strings and imports
          const allStrings = new Set<string>();
          const allImports = new Set<string>();
          for (const fn of functions) {
            try {
              const ir = JSON.parse(fn.ir_json) as CanonicalFunction;
              for (const s of ir.strings ?? []) allStrings.add(s.value);
              for (const i of ir.imports ?? []) allImports.add(i.name);
            } catch {
              /* skip malformed */
            }
          }

          const summary = {
            status: "success",
            binary: {
              hash: binary.hash,
              name: binary.name,
              arch: binary.arch,
              importedAt: binary.imported_at,
            },
            functions: {
              total: functions.length,
              ghidra: ghidraFns.length,
              angr: angrFns.length,
              named: functions.filter((f) => f.raw_name && !f.raw_name.startsWith("FUN_")).length,
            },
            strings: [...allStrings].slice(0, 50),
            imports: [...allImports].slice(0, 50),
            topFunctions: functions.slice(0, 20).map((f) => ({
              id: f.id,
              address: f.address,
              name: f.raw_name,
            })),
          };

          return {
            content: [{ type: "text" as const, text: JSON.stringify(summary) }],
          };
        } finally {
          db.close();
        }
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ status: "error", error: err instanceof Error ? err.message : String(err) }),
            },
          ],
        };
      }
    },
  );
  registeredTools.push("summarize_binary");

  return {
    mcpServer,
    getRegisteredTools: () => [...registeredTools],
    healthCheck: () => ({
      status: "ok",
      version: SERVER_VERSION,
      tools: [...registeredTools],
    }),
  };
}
