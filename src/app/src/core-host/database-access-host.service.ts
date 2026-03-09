import { Injectable } from "@angular/core";
import { DatabaseAccessContract } from "@cogno/core-sdk";
import { DB } from "../_tauri/db";

@Injectable({ providedIn: "root" })
export class DatabaseAccessHostService implements DatabaseAccessContract {
  async execute(query: string, parameters?: ReadonlyArray<unknown>): Promise<void> {
    await DB.execute(query, parameters as unknown[] | undefined);
  }

  async select<T = unknown>(query: string, parameters?: ReadonlyArray<unknown>): Promise<T> {
    return DB.select<T>(query, parameters as unknown[] | undefined);
  }

  async transaction<T>(handler: () => Promise<T>): Promise<T> {
    return DB.transaction(handler);
  }
}
