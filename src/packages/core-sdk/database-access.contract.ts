import { InjectionToken } from "@angular/core";

export interface DatabaseAccessContract {
  execute(query: string, parameters?: ReadonlyArray<unknown>): Promise<void>;
  select<T = unknown>(query: string, parameters?: ReadonlyArray<unknown>): Promise<T>;
  transaction<T>(handler: () => Promise<T>): Promise<T>;
}

export const databaseAccessToken = new InjectionToken<DatabaseAccessContract>(
  "database-access-token",
);
