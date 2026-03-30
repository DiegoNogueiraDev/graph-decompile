# @mcp-graph-workflow/genai-decompiler

MCP server for GenAI-powered binary decompilation with **Ghidra** and **angr** backends.

Exposes binary analysis tools via the [Model Context Protocol](https://modelcontextprotocol.io/) so Claude and other MCP-compatible agents can analyze, decompile, and explain compiled binaries.

## Quick Start

```bash
npx -y @mcp-graph-workflow/genai-decompiler
```

### Claude Code / `.mcp.json`

```json
{
  "mcpServers": {
    "genai-decompiler": {
      "command": "npx",
      "args": ["-y", "@mcp-graph-workflow/genai-decompiler"]
    }
  }
}
```

### Global Install

```bash
npm install -g @mcp-graph-workflow/genai-decompiler
genai-decompiler
```

## Tools

| Tool | Description |
|------|-------------|
| `analyze_binary` | Import and analyze a binary with Ghidra and/or angr |
| `list_functions` | List all discovered functions from a binary |
| `get_function` | Get detailed IR canonical data for a function |
| `decompile_function` | Get pseudocode with GenAI refinement |
| `explain_function` | Explain what a function does |
| `summarize_binary` | High-level analysis report |

## Requirements

- **Node.js** >= 20.0.0
- **Ghidra** (optional, for Ghidra backend) — set `DECOMPILER_PROJECT_ROOT` env var
- **angr** (optional, Python environment with angr installed)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DECOMPILER_PROJECT_ROOT` | Project root for workspaces and tools | `process.cwd()` |

## License

MIT
