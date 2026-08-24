export interface DatabaseStatementContract {
  readonly sql: string;
  readonly params?: ReadonlyArray<unknown>;
}

export interface DatabaseExecuteResultContract {
  readonly rowsAffected: number;
  readonly lastInsertId: number;
}

/**
 * SQL access to the application database. Statements passed to `batch`
 * run in one transaction — all of them take effect or none does. There is
 * deliberately no way to hold a transaction open across calls.
 */
export interface DatabaseAccessContract {
  execute(
    query: string,
    parameters?: ReadonlyArray<unknown>,
  ): Promise<DatabaseExecuteResultContract>;
  select<T = unknown>(query: string, parameters?: ReadonlyArray<unknown>): Promise<T>;
  batch(
    statements: ReadonlyArray<DatabaseStatementContract>,
  ): Promise<ReadonlyArray<DatabaseExecuteResultContract>>;
}

export abstract class DatabaseAccess implements DatabaseAccessContract {
  abstract execute(
    query: string,
    parameters?: ReadonlyArray<unknown>,
  ): Promise<DatabaseExecuteResultContract>;
  abstract select<T = unknown>(query: string, parameters?: ReadonlyArray<unknown>): Promise<T>;
  abstract batch(
    statements: ReadonlyArray<DatabaseStatementContract>,
  ): Promise<ReadonlyArray<DatabaseExecuteResultContract>>;
}
