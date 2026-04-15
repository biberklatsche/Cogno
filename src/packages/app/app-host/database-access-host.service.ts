import { Injectable } from "@angular/core";
import { DB } from "@cogno/app-tauri/db";
import { DatabaseAccessContract } from "@cogno/core-api";

@Injectable({ providedIn: "root" })
export class DatabaseAccessHostService implements DatabaseAccessContract {
  async execute(query: string, parameters?: ReadonlyArray<unknown>): Promise<void> {
    await DB.execute(query, parameters as unknown[] | undefined);
  }

  async select<T = unknown>(query: string, parameters?: ReadonlyArray<unknown>): Promise<T> {
    return DB.select<T>(query, parameters as unknown[] | undefined);
  }

  async transaction<T>(
    handler: (databaseAccess: DatabaseAccessContract) => Promise<T>,
  ): Promise<T> {
    return DB.transaction(async (database) => {
      const transactionDatabaseAccess: DatabaseAccessContract = {
        execute: (query: string, parameters?: ReadonlyArray<unknown>) =>
          database.execute(query, parameters as unknown[] | undefined),
        select: <Result = unknown>(query: string, parameters?: ReadonlyArray<unknown>) =>
          database.select<Result>(query, parameters as unknown[] | undefined),
        transaction: <NestedResult>(
          nestedHandler: (databaseAccess: DatabaseAccessContract) => Promise<NestedResult>,
        ) => database.transaction(() => nestedHandler(transactionDatabaseAccess)),
      };
      return handler(transactionDatabaseAccess);
    });
  }
}
