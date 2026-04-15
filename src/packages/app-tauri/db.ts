import TauriDatabase from "@tauri-apps/plugin-sql";

export interface IDatabase {
  load(path: string): Promise<void>;

  execute(query: string, params?: unknown[]): Promise<void>;

  select<T = unknown>(query: string, params?: unknown[]): Promise<T>;

  transaction<T>(fn: (database: IDatabase) => Promise<T>): Promise<T>;
}

let _db: TauriDatabase;
let operationQueue: Promise<void> = Promise.resolve();

async function runSerialized<T>(operation: () => Promise<T>): Promise<T> {
  const previousOperation = operationQueue;
  let releaseOperationQueue: () => void = () => undefined;
  operationQueue = new Promise<void>((resolve) => {
    releaseOperationQueue = resolve;
  });

  await previousOperation;
  try {
    return await operation();
  } finally {
    releaseOperationQueue();
  }
}

export const DB: IDatabase = {
  async load(path: string): Promise<void> {
    _db = await TauriDatabase.load(path);
  },
  async execute(query: string, params?: unknown[]): Promise<void> {
    await runSerialized(() => _db.execute(query, params));
  },
  async select<T = unknown>(query: string, params?: unknown[]): Promise<T> {
    return runSerialized(() => _db.select<T>(query, params));
  },
  async transaction<T>(fn: (database: IDatabase) => Promise<T>): Promise<T> {
    return runSerialized(async () => {
      const transactionDatabase: IDatabase = {
        load: async (): Promise<void> => {
          throw new Error("Database load is not available inside a transaction.");
        },
        execute: async (query: string, params?: unknown[]): Promise<void> => {
          await _db.execute(query, params);
        },
        select: async <Result = unknown>(query: string, params?: unknown[]): Promise<Result> => {
          return _db.select<Result>(query, params);
        },
        transaction: async <NestedResult>(
          nestedHandler: (database: IDatabase) => Promise<NestedResult>,
        ): Promise<NestedResult> => {
          return nestedHandler(transactionDatabase);
        },
      };
      await _db.execute("BEGIN IMMEDIATE;");
      try {
        const result = await fn(transactionDatabase);
        await _db.execute("COMMIT;");
        return result;
      } catch (error) {
        try {
          await _db.execute("ROLLBACK;");
        } catch {}
        throw error;
      }
    });
  },
};
