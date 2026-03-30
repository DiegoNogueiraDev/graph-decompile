// Ghidra headless script: Extract functions, strings, and imports to JSON
// Usage: analyzeHeadless <project> <name> -import <binary> -postScript ExtractAll.java <output.json>
// @category GenAI-Decompiler

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import ghidra.app.script.GhidraScript;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.FunctionIterator;
import ghidra.program.model.data.StringDataInstance;
import ghidra.program.model.listing.Data;
import ghidra.program.model.listing.DataIterator;
import ghidra.program.model.symbol.ExternalManager;
import ghidra.program.model.symbol.ExternalLocationIterator;
import ghidra.program.model.symbol.ExternalLocation;

import java.io.FileWriter;
import java.io.IOException;

public class ExtractAll extends GhidraScript {

    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        if (args.length < 1) {
            printerr("Usage: ExtractAll.java <output_path>");
            return;
        }

        String outputPath = args[0];
        JsonObject root = new JsonObject();

        try {
            // Binary metadata
            JsonObject binary = new JsonObject();
            binary.addProperty("name", currentProgram.getName());
            binary.addProperty("arch", currentProgram.getLanguage().getProcessor().toString());
            binary.addProperty("format", currentProgram.getExecutableFormat());
            root.add("binary", binary);

            // Functions
            JsonArray functions = new JsonArray();
            FunctionIterator funcIter = currentProgram.getFunctionManager().getFunctions(true);
            while (funcIter.hasNext() && !monitor.isCancelled()) {
                Function func = funcIter.next();
                JsonObject fn = new JsonObject();
                fn.addProperty("name", func.getName());
                fn.addProperty("address", func.getEntryPoint().toString());
                fn.addProperty("size", func.getBody().getNumAddresses());
                functions.add(fn);
            }
            root.add("functions", functions);

            // Strings
            JsonArray strings = new JsonArray();
            DataIterator dataIter = currentProgram.getListing().getDefinedData(true);
            while (dataIter.hasNext() && !monitor.isCancelled()) {
                Data data = dataIter.next();
                if (data.hasStringValue()) {
                    JsonObject str = new JsonObject();
                    str.addProperty("address", data.getAddress().toString());
                    str.addProperty("value", data.getDefaultValueRepresentation());
                    strings.add(str);
                }
            }
            root.add("strings", strings);

            // Imports
            JsonArray imports = new JsonArray();
            ExternalManager extMgr = currentProgram.getExternalManager();
            for (String libName : extMgr.getExternalLibraryNames()) {
                ExternalLocationIterator extIter = extMgr.getExternalLocations(libName);
                while (extIter.hasNext()) {
                    ExternalLocation extLoc = extIter.next();
                    JsonObject imp = new JsonObject();
                    imp.addProperty("name", extLoc.getLabel());
                    imp.addProperty("library", libName);
                    if (extLoc.getAddress() != null) {
                        imp.addProperty("address", extLoc.getAddress().toString());
                    }
                    imports.add(imp);
                }
            }
            root.add("imports", imports);

            root.addProperty("status", "success");
        } catch (Exception e) {
            root.addProperty("status", "error");
            root.addProperty("error", e.getMessage());
        }

        // Write output
        try (FileWriter writer = new FileWriter(outputPath)) {
            writer.write(root.toString());
        }

        println("ExtractAll: output written to " + outputPath);
    }
}
