import { describe, it, expect } from "vitest";
import {
  createDecompilerServer,
  SERVER_NAME,
  SERVER_VERSION,
  type DecompilerServer,
} from "../server.js";

describe("MCP server setup", () => {
  let server: DecompilerServer;

  it("creates server with correct name and version", () => {
    server = createDecompilerServer();
    expect(SERVER_NAME).toBe("genai-decompiler-mcp");
    expect(SERVER_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("has registered tools", () => {
    server = createDecompilerServer();
    const tools = server.getRegisteredTools();
    expect(tools.length).toBeGreaterThan(0);
  });

  it("registers analyze_binary tool", () => {
    server = createDecompilerServer();
    const tools = server.getRegisteredTools();
    expect(tools).toContain("analyze_binary");
  });

  it("registers list_functions tool", () => {
    server = createDecompilerServer();
    const tools = server.getRegisteredTools();
    expect(tools).toContain("list_functions");
  });

  it("registers get_function tool", () => {
    server = createDecompilerServer();
    const tools = server.getRegisteredTools();
    expect(tools).toContain("get_function");
  });

  it("health check returns version and tool list", () => {
    server = createDecompilerServer();
    const health = server.healthCheck();
    expect(health.version).toBe(SERVER_VERSION);
    expect(health.tools).toEqual(server.getRegisteredTools());
    expect(health.status).toBe("ok");
  });
});
