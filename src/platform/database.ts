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
 * The application database lives in the Rust process behind a single
 * connection. `batch` runs every statement in one transaction — the only
 * way to group statements atomically, so a transaction can never be left
 * open between calls.
 */
export const Database = {
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
  },

  execute(statement: DatabaseStatement): Promise<DatabaseExecuteResult> {
    return invoke<DatabaseExecuteResult>("db_execute", { statement });
  },

  select<T = unknown>(statement: DatabaseStatement): Promise<T[]> {
    return invoke<T[]>("db_select", { statement });
  },

  batch(statements: ReadonlyArray<DatabaseStatement>): Promise<DatabaseExecuteResult[]> {
    return invoke<DatabaseExecuteResult[]>("db_batch", { statements });
  },
};

export type DatabaseStatementContract = DatabaseStatement;

/**
 * SQL access to the application database. Statements passed to `batch` run
 * in one transaction — all of them take effect or none does. There is
 * deliberately no way to hold a transaction open across calls.
 */
export interface DatabaseAccessContract {
  execute(query: string, parameters?: ReadonlyArray<unknown>): Promise<DatabaseExecuteResult>;
  select<T = unknown>(query: string, parameters?: ReadonlyArray<unknown>): Promise<T>;
  batch(
    statements: ReadonlyArray<DatabaseStatement>,
  ): Promise<ReadonlyArray<DatabaseExecuteResult>>;
}

@Injectable({ providedIn: "root" })
export class DatabaseAccess implements DatabaseAccessContract {
  execute(query: string, parameters?: ReadonlyArray<unknown>): Promise<DatabaseExecuteResult> {
    return Database.execute({ sql: query, params: parameters });
  }

  select<T = unknown>(query: string, parameters?: ReadonlyArray<unknown>): Promise<T> {
    return Database.select({ sql: query, params: parameters }) as Promise<T>;
  }

  batch(
    statements: ReadonlyArray<DatabaseStatement>,
  ): Promise<ReadonlyArray<DatabaseExecuteResult>> {
    return Database.batch(statements);
  }
}
