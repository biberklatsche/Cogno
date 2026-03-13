import TauriDatabase from '@tauri-apps/plugin-sql';

export interface IDatabase {
    load(path: string): Promise<void>

    execute(query: string, params?: unknown[]): Promise<void>;

    select<T = unknown>(query: string, params?: unknown[]): Promise<T>;

    transaction<T>(fn: () => Promise<T>): Promise<T>;
}

let _db: TauriDatabase;
let txQueue: Promise<void> = Promise.resolve();
export const DB: IDatabase = {

    async load(path: string): Promise<void> {
        _db = await TauriDatabase.load(path);
    },
    async execute(query: string, params?: unknown[]): Promise<void> {
        await _db.execute(query, params);
    },
    async select<T = unknown>(query: string, params?: unknown[]): Promise<T> {
        return _db.select<T>(query, params);
    },
    async transaction<T>(fn: () => Promise<T>): Promise<T> {
        // Serialize transactions per DB connection to avoid overlapping BEGIN calls.
        const previous = txQueue;
        let release!: () => void;
        txQueue = new Promise<void>(resolve => {
            release = resolve;
        });

        await previous;
        try {
            await _db.execute("BEGIN IMMEDIATE;");
            try {
                const result = await fn();
                await _db.execute("COMMIT;");
                return result;
            } catch (e) {
                try {
                    await _db.execute("ROLLBACK;");
                } catch {
                    // Transaction may already be closed by SQLite.
                }
                throw e;
            }
        } finally {
            release();
        }
    }

}
