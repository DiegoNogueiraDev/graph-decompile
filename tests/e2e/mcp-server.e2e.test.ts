import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createDecompilerServer } from "@genai-decompiler/mcp-server";
import { existsSync } from "node:fs";
import { join } from "node:path";

const PROJECT_ROOT = join(import.meta.dirname, "..", "..");
const BIN_DIR = join(PROJECT_ROOT, "bin");

describe("E2E: MCP server via in-memory transport", () => {
  let client: Client;
  let serverTransport: InMemoryTransport;
  let clientTransport: InMemoryTransport;

  beforeAll(async () => {
    const { mcpServer } = createDecompilerServer();

    [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    client = new Client({ name: "test-client", version: "1.0.0" });

    await mcpServer.connect(serverTransport);
    await client.connect(clientTransport);
  });

  afterAll(async () => {
    await clientTransport.close();
    await serverTransport.close();
  });

  it("responds to tools/list with ≥6 available tools", async () => {
    const result = await client.listTools();

    expect(result.tools).toBeDefined();
    expect(Array.isArray(result.tools)).toBe(true);
    expect(result.tools.length).toBeGreaterThanOrEqual(6);

    const toolNames = result.tools.map((t) => t.name);
    expect(toolNames).toContain("analyze_binary");
    expect(toolNames).toContain("list_functions");
    expect(toolNames).toContain("get_function");
    expect(toolNames).toContain("explain_function");
    expect(toolNames).toContain("decompile_function");
  });

  it("returns a valid result for analyze_binary with sample binary path", async () => {
    const sampleBinary = join(BIN_DIR, "MEA");

    const result = await client.callTool({
      name: "analyze_binary",
      arguments: { binaryPath: sampleBinary, backends: ["ghidra", "angr"] },
    });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content.length).toBeGreaterThan(0);

    const textContent = result.content[0];
    expect(textContent).toHaveProperty("type", "text");
    expect(textContent).toHaveProperty("text");

    const parsed = JSON.parse((textContent as { type: "text"; text: string }).text);
    expect(parsed).toHaveProperty("binaryPath", sampleBinary);
    expect(parsed).toHaveProperty("backends");
  }, 30_000);

  it("each tool has a valid input schema", async () => {
    const result = await client.listTools();

    for (const tool of result.tools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe("object");
    }
  });
});

describe("E2E: Sample binaries exist in bin/", () => {
  it("bin/ directory contains at least one ELF binary", () => {
    expect(existsSync(BIN_DIR)).toBe(true);

    const elfBinaries = ["MEA", "MGA", "MTA", "MTC"];
    const found = elfBinaries.filter((name) => existsSync(join(BIN_DIR, name)));

    expect(found.length).toBeGreaterThanOrEqual(1);
  });

  it("MEA sample binary exists and is non-empty", () => {
    const meaPath = join(BIN_DIR, "MEA");
    expect(existsSync(meaPath)).toBe(true);

    const { statSync } = require("node:fs");
    const stat = statSync(meaPath);
    expect(stat.size).toBeGreaterThan(0);
  });
});
