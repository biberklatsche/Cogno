export interface DatabaseAccessContract {
  execute(query: string, parameters?: ReadonlyArray<unknown>): Promise<void>;
  select<T = unknown>(query: string, parameters?: ReadonlyArray<unknown>): Promise<T>;
  transaction<T>(handler: (databaseAccess: DatabaseAccessContract) => Promise<T>): Promise<T>;
}

export abstract class DatabaseAccess implements DatabaseAccessContract {
  abstract execute(query: string, parameters?: ReadonlyArray<unknown>): Promise<void>;
  abstract select<T = unknown>(query: string, parameters?: ReadonlyArray<unknown>): Promise<T>;
  abstract transaction<T>(
    handler: (databaseAccess: DatabaseAccessContract) => Promise<T>,
  ): Promise<T>;
}
