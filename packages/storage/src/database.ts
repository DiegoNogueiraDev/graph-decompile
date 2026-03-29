import BetterSqlite3 from "better-sqlite3";

export type Database = BetterSqlite3.Database;

const MIGRATIONS: { version: number; up: string; down: string }[] = [
  {
    version: 1,
    up: `
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS binaries (
        hash TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        arch TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        imported_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_binaries_hash ON binaries(hash);

      CREATE TABLE IF NOT EXISTS functions (
        id TEXT PRIMARY KEY,
        binary_hash TEXT NOT NULL REFERENCES binaries(hash),
        address TEXT NOT NULL,
        raw_name TEXT,
        normalized_name TEXT,
        confidence REAL NOT NULL DEFAULT 0,
        ir_json TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_functions_binary_hash ON functions(binary_hash);
      CREATE INDEX IF NOT EXISTS idx_functions_address ON functions(address);

      CREATE TABLE IF NOT EXISTS artifacts (
        id TEXT PRIMARY KEY,
        binary_hash TEXT NOT NULL REFERENCES binaries(hash),
        type TEXT NOT NULL,
        path TEXT NOT NULL,
        metadata_json TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS hypotheses (
        id TEXT PRIMARY KEY,
        function_id TEXT NOT NULL REFERENCES functions(id),
        type TEXT NOT NULL,
        value TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 0,
        source TEXT NOT NULL,
        accepted INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
    `,
    down: `
      DROP TABLE IF EXISTS hypotheses;
      DROP TABLE IF EXISTS artifacts;
      DROP TABLE IF EXISTS functions;
      DROP TABLE IF EXISTS binaries;
      DROP INDEX IF EXISTS idx_binaries_hash;
      DROP INDEX IF EXISTS idx_functions_binary_hash;
      DROP INDEX IF EXISTS idx_functions_address;
    `,
  },
];

export function createDatabase(path: string): Database {
  const db = new BetterSqlite3(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export function runMigrations(db: Database): void {
  // Ensure migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const currentVersion = getMigrationVersion(db);

  for (const migration of MIGRATIONS) {
    if (migration.version > currentVersion) {
      db.exec(migration.up);
      db.prepare("INSERT OR REPLACE INTO migrations (version, applied_at) VALUES (?, ?)").run(
        migration.version,
        new Date().toISOString(),
      );
    }
  }
}

export function rollbackMigration(db: Database): void {
  const currentVersion = getMigrationVersion(db);
  if (currentVersion === 0) return;

  const migration = MIGRATIONS.find((m) => m.version === currentVersion);
  if (migration) {
    db.exec(migration.down);
    db.prepare("DELETE FROM migrations WHERE version = ?").run(currentVersion);
  }
}

export function getMigrationVersion(db: Database): number {
  try {
    const row = db
      .prepare("SELECT MAX(version) as version FROM migrations")
      .get() as { version: number | null } | undefined;
    return row?.version ?? 0;
  } catch {
    return 0;
  }
}
