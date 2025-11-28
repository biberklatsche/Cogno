import TauriDatabase from '@tauri-apps/plugin-sql';

export interface IDatabase {
  create(path: string): Promise<void>
  execute(query: string, params?: unknown[]): Promise<void>;
  query<T = unknown>(query: string, params?: unknown[]): Promise<T>;
  close(): Promise<void>;
}

let _db: TauriDatabase;
export const DB: IDatabase = {

    async create(path: string): Promise<void> {
        _db = await TauriDatabase.load(path);
    },
    async close(): Promise<void> {
        await _db.close();
    },
    async execute(query: string, params?: unknown[]): Promise<void> {
        await _db.execute(query, params);
    },

    async query<T = unknown>(query: string, params?: unknown[]): Promise<T> {
        return _db.select<T>(query, params);
    }

}
