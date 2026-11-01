import { Injectable } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";

export interface DatabaseMigration {
  id: string;
  sql: string;
  /** The step reads from the previous-generation database, attached as `legacy`. */
  usesLegacy?: boolean;
}

export interface DatabaseStatement {
  sql: string;
  params?: ReadonlyArray<unknown>;
}

export interface DatabaseExecuteResult {
  rowsAffected: number;
  lastInsertId: number;
}

interface DatabaseTableRecovery {
  name: string;
  rowsRestored: number;
  error: string | null;
}

export interface DatabaseRecoveryReport {
  reasons: string[];
  quarantinedPath: string;
  tables: DatabaseTableRecovery[];
}

interface DatabaseLegacyError {
  id: string;
  error: string;
}

export interface DatabaseOpenReport {
  path: string;
  recovery: DatabaseRecoveryReport | null;
  appliedMigrations: string[];
  legacyErrors: DatabaseLegacyError[];
}

/**
 * SQL access to the application database, which lives in the Rust process
 * behind a single connection. Statements passed to `batch` run in one
 * transaction — all of them take effect or none does. There is deliberately
 * no way to hold a transaction open across calls.
 */
@Injectable({ providedIn: "root" })
export class DatabaseAccess {
  open(
    devMode: boolean,
    migrations: ReadonlyArray<DatabaseMigration>,
    legacyPath?: string,
  ): Promise<DatabaseOpenReport> {
    return invoke<DatabaseOpenReport>("db_open", {
      devMode,
      migrations,
      legacyPath: legacyPath ?? null,
    });
  }

  execute(query: string, parameters?: ReadonlyArray<unknown>): Promise<DatabaseExecuteResult> {
    return invoke<DatabaseExecuteResult>("db_execute", {
      statement: { sql: query, params: parameters },
    });
  }

  select<T = unknown>(query: string, parameters?: ReadonlyArray<unknown>): Promise<T> {
    return invoke<T>("db_select", { statement: { sql: query, params: parameters } });
  }

  batch(
    statements: ReadonlyArray<DatabaseStatement>,
  ): Promise<ReadonlyArray<DatabaseExecuteResult>> {
    return invoke<DatabaseExecuteResult[]>("db_batch", { statements });
  }
}
