import { invoke } from "@tauri-apps/api/core";

export interface DatabaseTableRecovery {
  name: string;
  rowsRestored: number;
  error: string | null;
}

export interface DatabaseRecoveryReport {
  reasons: string[];
  quarantinedPath: string;
  tables: DatabaseTableRecovery[];
}

export interface DatabaseOpenReport {
  path: string;
  recovery: DatabaseRecoveryReport | null;
  appliedMigrations: string[];
}

/**
 * The application database lives in the Rust process behind a single
 * connection. The frontend never sends SQL; it opens the database once and
 * then calls typed commands.
 */
export const Database = {
  open(devMode: boolean): Promise<DatabaseOpenReport> {
    return invoke<DatabaseOpenReport>("db_open", { devMode });
  },
};
