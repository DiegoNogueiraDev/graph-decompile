import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export const SERVER_NAME = "genai-decompiler-mcp";
export const SERVER_VERSION = "0.0.1";

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
    async ({ binaryPath, backends }) => ({
      content: [{ type: "text" as const, text: JSON.stringify({ status: "pending", binaryPath, backends }) }],
    }),
  );
  registeredTools.push("analyze_binary");

  // Tool: list_functions
  mcpServer.tool(
    "list_functions",
    "List all functions discovered in a previously analyzed binary",
    {
      binaryHash: z.string().describe("SHA-256 hash of the binary"),
    },
    async ({ binaryHash }) => ({
      content: [{ type: "text" as const, text: JSON.stringify({ status: "pending", binaryHash }) }],
    }),
  );
  registeredTools.push("list_functions");

  // Tool: get_function
  mcpServer.tool(
    "get_function",
    "Get detailed IR canonical data for a specific function",
    {
      functionId: z.string().describe("Function ID or address"),
    },
    async ({ functionId }) => ({
      content: [{ type: "text" as const, text: JSON.stringify({ status: "pending", functionId }) }],
    }),
  );
  registeredTools.push("get_function");

  // Tool: explain_function
  mcpServer.tool(
    "explain_function",
    "Use GenAI to explain what a decompiled function does",
    {
      functionId: z.string().describe("Function ID to explain"),
    },
    async ({ functionId }) => ({
      content: [{ type: "text" as const, text: JSON.stringify({ status: "pending", functionId }) }],
    }),
  );
  registeredTools.push("explain_function");

  // Tool: decompile_function
  mcpServer.tool(
    "decompile_function",
    "Get high-level pseudocode for a function with GenAI refinement",
    {
      functionId: z.string().describe("Function ID to decompile"),
    },
    async ({ functionId }) => ({
      content: [{ type: "text" as const, text: JSON.stringify({ status: "pending", functionId }) }],
    }),
  );
  registeredTools.push("decompile_function");

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
