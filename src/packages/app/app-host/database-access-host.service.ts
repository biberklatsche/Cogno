import { Injectable } from "@angular/core";
import { Database } from "@cogno/app-tauri/database";
import {
  DatabaseAccess,
  DatabaseExecuteResultContract,
  DatabaseStatementContract,
} from "@cogno/core-api";

@Injectable({ providedIn: "root" })
export class DatabaseAccessHostService extends DatabaseAccess {
  execute(
    query: string,
    parameters?: ReadonlyArray<unknown>,
  ): Promise<DatabaseExecuteResultContract> {
    return Database.execute({ sql: query, params: parameters });
  }

  select<T = unknown>(query: string, parameters?: ReadonlyArray<unknown>): Promise<T> {
    return Database.select({ sql: query, params: parameters }) as Promise<T>;
  }

  batch(
    statements: ReadonlyArray<DatabaseStatementContract>,
  ): Promise<ReadonlyArray<DatabaseExecuteResultContract>> {
    return Database.batch(statements);
  }
}
