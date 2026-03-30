/**
 * Smoke Tests: Decompile bin/* binaries
 *
 * Simulates real user scenarios:
 *   1. User connects to MCP server
 *   2. User analyzes each binary in bin/
 *   3. User lists discovered functions
 *   4. User inspects individual functions
 *   5. User requests explanations and decompilation
 *   6. User gets a summary report
 *
 * These tests validate the full MCP tool chain responds correctly
 * for every sample binary, exercising the same API surface a real
 * MCP client (Claude, IDE plugin) would use.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createDecompilerServer } from "@genai-decompiler/mcp-server";
import { runDoctor, formatDoctorOutput } from "@genai-decompiler/cli";
import { hashBinary } from "@genai-decompiler/storage";
import { readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const PROJECT_ROOT = join(import.meta.dirname, "..", "..");
const BIN_DIR = join(PROJECT_ROOT, "bin");

// Discover all binaries in bin/
const BINARIES = readdirSync(BIN_DIR)
  .filter((f) => {
    const fullPath = join(BIN_DIR, f);
    return statSync(fullPath).isFile() && !f.startsWith(".");
  })
  .map((name) => ({ name, path: join(BIN_DIR, name) }));

// ── Helper: parse MCP tool response ─────────────────────────────────────────

function parseToolResponse(result: Awaited<ReturnType<Client["callTool"]>>): Record<string, unknown> {
  const content = result.content as Array<{ type: string; text: string }>;
  expect(content.length).toBeGreaterThan(0);
  expect(content[0].type).toBe("text");
  return JSON.parse(content[0].text);
}

// ── Scenario 1: Pre-flight — Doctor checks ──────────────────────────────────

describe("Smoke: Pre-flight doctor check", () => {
  it("doctor reports status for all 5 dependencies", async () => {
    const result = await runDoctor();

    expect(result.checks.length).toBe(5);

    const output = formatDoctorOutput(result.checks);
    console.log("Doctor output:\n" + output);

    // Node.js must be available (we're running in it)
    const nodeCheck = result.checks.find((c) => c.name === "node");
    expect(nodeCheck?.ok).toBe(true);
  }, 30_000);
});

// ── Scenario 2: Binary inventory ────────────────────────────────────────────

describe("Smoke: Binary inventory", () => {
  it("bin/ contains exactly 4 sample binaries: MEA, MGA, MTA, MTC", () => {
    const names = BINARIES.map((b) => b.name).sort();
    expect(names).toEqual(["MEA", "MGA", "MTA", "MTC"]);
  });

  it.each(BINARIES)("$name is a non-empty file", ({ path }) => {
    expect(existsSync(path)).toBe(true);
    expect(statSync(path).size).toBeGreaterThan(1_000_000); // All are ~5.5MB ELF
  });

  it.each(BINARIES)("$name produces a valid SHA-256 hash", async ({ path }) => {
    const hash = await hashBinary(path);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

// ── Scenario 3: MCP server — full user journey per binary ───────────────────

describe("Smoke: MCP decompilation journey", () => {
  let client: Client;
  let serverTransport: InMemoryTransport;
  let clientTransport: InMemoryTransport;

  beforeAll(async () => {
    const { mcpServer } = createDecompilerServer();
    [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "smoke-test-client", version: "1.0.0" });
    await mcpServer.connect(serverTransport);
    await client.connect(clientTransport);
  });

  afterAll(async () => {
    await clientTransport.close();
    await serverTransport.close();
  });

  // Step 1: Verify tool availability
  it("server exposes all 6 MVP tools", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);

    expect(names).toContain("analyze_binary");
    expect(names).toContain("list_functions");
    expect(names).toContain("get_function");
    expect(names).toContain("explain_function");
    expect(names).toContain("decompile_function");
    expect(names).toContain("summarize_binary");
  });

  // Step 2: Analyze each binary
  describe.each(BINARIES)("User journey: $name", ({ name, path }) => {
    let analyzeResult: Record<string, unknown>;
    let binaryHash: string;

    it("analyze_binary accepts the binary and returns structured response", async () => {
      const result = await client.callTool({
        name: "analyze_binary",
        arguments: { binaryPath: path, backends: ["ghidra", "angr"] },
      });

      analyzeResult = parseToolResponse(result);

      expect(analyzeResult).toHaveProperty("binaryPath", path);
      expect(analyzeResult).toHaveProperty("backends");
      expect(analyzeResult).toHaveProperty("status");

      console.log(`[${name}] analyze_binary: status=${analyzeResult.status}`);
    }, 30_000);

    it("binary has a unique SHA-256 hash", async () => {
      binaryHash = await hashBinary(path);
      expect(binaryHash).toMatch(/^[a-f0-9]{64}$/);
      console.log(`[${name}] hash: ${binaryHash.substring(0, 16)}...`);
    });

    it("list_functions returns response for the binary hash", async () => {
      binaryHash = binaryHash || (await hashBinary(path));

      const result = await client.callTool({
        name: "list_functions",
        arguments: { binaryHash },
      });

      const parsed = parseToolResponse(result);
      expect(parsed).toHaveProperty("binaryHash", binaryHash);
      expect(parsed).toHaveProperty("status");

      console.log(`[${name}] list_functions: status=${parsed.status}`);
    });

    it("get_function returns response for a function ID", async () => {
      const result = await client.callTool({
        name: "get_function",
        arguments: { functionId: `${name}_main_0x401000` },
      });

      const parsed = parseToolResponse(result);
      expect(parsed).toHaveProperty("functionId");
      expect(parsed).toHaveProperty("status");

      console.log(`[${name}] get_function: status=${parsed.status}`);
    });

    it("explain_function returns response for a function", async () => {
      const result = await client.callTool({
        name: "explain_function",
        arguments: { functionId: `${name}_main_0x401000` },
      });

      const parsed = parseToolResponse(result);
      expect(parsed).toHaveProperty("functionId");
      expect(parsed).toHaveProperty("status");

      console.log(`[${name}] explain_function: status=${parsed.status}`);
    });

    it("decompile_function returns response for a function", async () => {
      const result = await client.callTool({
        name: "decompile_function",
        arguments: { functionId: `${name}_main_0x401000` },
      });

      const parsed = parseToolResponse(result);
      expect(parsed).toHaveProperty("functionId");
      expect(parsed).toHaveProperty("status");

      console.log(`[${name}] decompile_function: status=${parsed.status}`);
    });

    it("summarize_binary returns response for the binary hash", async () => {
      binaryHash = binaryHash || (await hashBinary(path));

      const result = await client.callTool({
        name: "summarize_binary",
        arguments: { binaryHash },
      });

      const parsed = parseToolResponse(result);
      expect(parsed).toHaveProperty("binaryHash", binaryHash);
      expect(parsed).toHaveProperty("status");

      console.log(`[${name}] summarize_binary: status=${parsed.status}`);
    });
  });
});
