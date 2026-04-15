export interface DatabaseAccessContract {
  execute(query: string, parameters?: ReadonlyArray<unknown>): Promise<void>;
  select<T = unknown>(query: string, parameters?: ReadonlyArray<unknown>): Promise<T>;
  transaction<T>(handler: (databaseAccess: DatabaseAccessContract) => Promise<T>): Promise<T>;
}
