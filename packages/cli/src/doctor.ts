import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface DependencyCheck {
  name: string;
  ok: boolean;
  version?: string;
  path?: string;
  error?: string;
}

export interface DoctorResult {
  checks: DependencyCheck[];
  allOk: boolean;
}

function exec(command: string, args: string[]): Promise<{ stdout: string; ok: boolean }> {
  return new Promise((resolve) => {
    execFile(command, args, { timeout: 10_000 }, (err, stdout) => {
      if (err) {
        resolve({ stdout: "", ok: false });
      } else {
        resolve({ stdout: stdout.trim(), ok: true });
      }
    });
  });
}

export async function checkNode(): Promise<DependencyCheck> {
  try {
    const { stdout, ok } = await exec("node", ["--version"]);
    if (!ok) return { name: "node", ok: false, error: "node not found" };

    const version = stdout.replace(/^v/, "");
    const major = parseInt(version.split(".")[0], 10);
    return {
      name: "node",
      ok: major >= 18,
      version,
      error: major < 18 ? `Node.js >= 18 required, found ${version}` : undefined,
    };
  } catch {
    return { name: "node", ok: false, error: "node not found" };
  }
}

export async function checkJava(): Promise<DependencyCheck> {
  try {
    const { stdout, ok } = await exec("java", ["-version"]);
    // java -version outputs to stderr, but execFile captures stdout
    // Try java --version which outputs to stdout on newer JDKs
    if (!ok) {
      const alt = await exec("java", ["--version"]);
      if (!alt.ok) return { name: "java", ok: false, error: "Java not found" };
      const version = alt.stdout.split("\n")[0] ?? "";
      return { name: "java", ok: true, version };
    }
    return { name: "java", ok: true, version: stdout.split("\n")[0] ?? "" };
  } catch {
    return { name: "java", ok: false, error: "Java not found" };
  }
}

export async function checkGhidra(ghidraPath?: string): Promise<DependencyCheck> {
  if (!ghidraPath) {
    return { name: "ghidra", ok: false, error: "Ghidra path not configured" };
  }

  const analyzeHeadless = join(ghidraPath, "support", "analyzeHeadless");
  if (existsSync(analyzeHeadless)) {
    return { name: "ghidra", ok: true, path: ghidraPath };
  }

  return { name: "ghidra", ok: false, error: `analyzeHeadless not found at ${ghidraPath}` };
}

export async function checkPython(): Promise<DependencyCheck> {
  for (const cmd of ["python3", "python"]) {
    const { stdout, ok } = await exec(cmd, ["--version"]);
    if (ok) {
      const version = stdout.replace(/^Python\s*/, "");
      const parts = version.split(".");
      const major = parseInt(parts[0], 10);
      const minor = parseInt(parts[1], 10);
      const meetsMin = major > 3 || (major === 3 && minor >= 9);
      return {
        name: "python",
        ok: meetsMin,
        version,
        path: cmd,
        error: meetsMin ? undefined : `Python >= 3.9 required, found ${version}`,
      };
    }
  }
  return { name: "python", ok: false, error: "Python not found" };
}

export async function checkAngr(): Promise<DependencyCheck> {
  for (const cmd of ["python3", "python"]) {
    const { ok } = await exec(cmd, ["-c", "import angr; print(angr.__version__)"]);
    if (ok) {
      return { name: "angr", ok: true };
    }
  }
  return { name: "angr", ok: false, error: "angr not installed (pip install angr)" };
}

export async function runDoctor(opts: { ghidraPath?: string } = {}): Promise<DoctorResult> {
  const checks = await Promise.all([
    checkNode(),
    checkJava(),
    checkGhidra(opts.ghidraPath),
    checkPython(),
    checkAngr(),
  ]);

  return {
    checks,
    allOk: checks.every((c) => c.ok),
  };
}

export function formatDoctorOutput(checks: DependencyCheck[]): string {
  const lines: string[] = [];
  for (const check of checks) {
    const icon = check.ok ? "[OK]" : "[FAIL]";
    const detail = check.ok
      ? check.version ?? check.path ?? "found"
      : check.error ?? "not found";
    lines.push(`${icon} ${check.name}: ${detail}`);
  }
  return lines.join("\n");
}

export function saveDoctorConfig(checks: DependencyCheck[], configDir: string): void {
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  const config: Record<string, { ok: boolean; version?: string; path?: string }> = {};
  for (const check of checks) {
    config[check.name] = {
      ok: check.ok,
      ...(check.version ? { version: check.version } : {}),
      ...(check.path ? { path: check.path } : {}),
    };
  }

  writeFileSync(join(configDir, "config.json"), JSON.stringify(config, null, 2));
}

export function loadConfig(configDir: string): Record<string, { ok?: boolean; version?: string; path?: string }> {
  const configPath = join(configDir, "config.json");
  if (!existsSync(configPath)) return {};

  try {
    return JSON.parse(readFileSync(configPath, "utf-8"));
  } catch {
    return {};
  }
}
