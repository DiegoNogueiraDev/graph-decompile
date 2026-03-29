import { createHash } from "node:crypto";
import { createReadStream, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export function hashBinary(binaryPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(binaryPath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

export function createWorkspace(baseDir: string, hash: string): string {
  const wsPath = join(baseDir, hash);
  if (!existsSync(wsPath)) {
    mkdirSync(wsPath, { recursive: true });
  }
  return wsPath;
}

export const ARTIFACT_DIRS = ["ghidra", "angr", "ir", "hypotheses"] as const;

export function createWorkspaceWithArtifacts(baseDir: string, hash: string): string {
  const wsPath = createWorkspace(baseDir, hash);
  for (const dir of ARTIFACT_DIRS) {
    const subDir = join(wsPath, dir);
    if (!existsSync(subDir)) {
      mkdirSync(subDir, { recursive: true });
    }
  }
  return wsPath;
}

export function isWorkspaceCached(baseDir: string, hash: string): boolean {
  return existsSync(join(baseDir, hash));
}
