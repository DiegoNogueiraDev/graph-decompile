#!/usr/bin/env python3
"""angr worker: Extract CFG, functions, blocks, edges, and AIL from a binary."""

import argparse
import json
import sys
import os


def analyze_binary(binary_path: str, timeout: int) -> dict:
    """Run angr analysis and extract structured data."""
    try:
        import angr
        import archinfo
    except ImportError:
        return {
            "status": "error",
            "error": "angr not installed. Run: pip install angr",
            "functions": [],
        }

    try:
        project = angr.Project(binary_path, auto_load_libs=False)

        binary_info = {
            "name": os.path.basename(binary_path),
            "arch": project.arch.name,
            "format": project.loader.main_object.__class__.__name__,
        }

        # Generate CFG
        cfg = project.analyses.CFGFast()

        functions = []
        ail_data = {}

        for func_addr, func in cfg.kb.functions.items():
            func_data = {
                "name": func.name,
                "address": hex(func_addr),
                "blocks": [],
                "edges": [],
            }

            # Extract blocks
            for block in func.blocks:
                try:
                    capstone_block = project.factory.block(block.addr, size=block.size)
                    instructions = []
                    for insn in capstone_block.capstone.insns:
                        instructions.append(f"{insn.mnemonic} {insn.op_str}".strip())

                    func_data["blocks"].append({
                        "address": hex(block.addr),
                        "size": block.size,
                        "instructions": instructions,
                    })
                except Exception:
                    func_data["blocks"].append({
                        "address": hex(block.addr),
                        "size": block.size,
                        "instructions": [],
                    })

            # Extract edges from CFG
            func_node = cfg.model.get_any_node(func_addr)
            if func_node:
                for successor in cfg.model.get_successors(func_node):
                    edge_type = "unconditional"
                    func_data["edges"].append({
                        "from": hex(func_node.addr),
                        "to": hex(successor.addr),
                        "type": edge_type,
                    })

            functions.append(func_data)

            # Extract AIL (lifted IR) if available
            try:
                dec = project.analyses.Decompiler(func)
                if dec and dec.codegen and dec.codegen.text:
                    ail_data[hex(func_addr)] = dec.codegen.text
            except Exception:
                pass

        return {
            "status": "success",
            "binary": binary_info,
            "functions": functions,
            "ail": ail_data,
        }

    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "functions": [],
        }


def main():
    parser = argparse.ArgumentParser(description="angr binary analysis worker")
    parser.add_argument("--binary", required=True, help="Path to binary file")
    parser.add_argument("--output", required=True, help="Path to output JSON file")
    parser.add_argument("--timeout", type=int, default=120, help="Analysis timeout in seconds")
    args = parser.parse_args()

    if not os.path.isfile(args.binary):
        result = {
            "status": "error",
            "error": f"Binary not found: {args.binary}",
            "functions": [],
        }
    else:
        result = analyze_binary(args.binary, args.timeout)

    with open(args.output, "w") as f:
        json.dump(result, f, indent=2)

    if result["status"] == "success":
        print(f"angr_worker: {len(result['functions'])} functions extracted -> {args.output}")
    else:
        print(f"angr_worker: error - {result.get('error', 'unknown')}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
