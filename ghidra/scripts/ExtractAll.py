# Ghidra headless script: Extract functions, strings, and imports to JSON
# Usage: analyzeHeadless <project> <name> -import <binary> -postScript ExtractAll.py <output.json>
# @category GenAI-Decompiler
# @runtime Jython

import json

def run():
    args = getScriptArgs()
    if len(args) < 1:
        printerr("Usage: ExtractAll.py <output_path>")
        return

    output_path = args[0]
    root = {}

    try:
        # Binary metadata
        root["binary"] = {
            "name": currentProgram.getName(),
            "arch": str(currentProgram.getLanguage().getProcessor()),
            "format": currentProgram.getExecutableFormat(),
        }

        # Functions
        functions = []
        func_iter = currentProgram.getFunctionManager().getFunctions(True)
        while func_iter.hasNext() and not monitor.isCancelled():
            func = func_iter.next()
            functions.append({
                "name": func.getName(),
                "address": str(func.getEntryPoint()),
                "size": int(func.getBody().getNumAddresses()),
            })
        root["functions"] = functions

        # Strings
        strings = []
        data_iter = currentProgram.getListing().getDefinedData(True)
        while data_iter.hasNext() and not monitor.isCancelled():
            data = data_iter.next()
            if data.hasStringValue():
                strings.append({
                    "address": str(data.getAddress()),
                    "value": data.getDefaultValueRepresentation(),
                })
        root["strings"] = strings

        # Imports
        imports = []
        ext_mgr = currentProgram.getExternalManager()
        for lib_name in ext_mgr.getExternalLibraryNames():
            ext_iter = ext_mgr.getExternalLocations(lib_name)
            while ext_iter.hasNext():
                ext_loc = ext_iter.next()
                imp = {
                    "name": ext_loc.getLabel(),
                    "library": lib_name,
                }
                if ext_loc.getAddress() is not None:
                    imp["address"] = str(ext_loc.getAddress())
                imports.append(imp)
        root["imports"] = imports

        root["status"] = "success"
    except Exception as e:
        root["status"] = "error"
        root["error"] = str(e)

    # Write output
    with open(output_path, "w") as f:
        f.write(json.dumps(root))

    println("ExtractAll: output written to " + output_path)

run()
