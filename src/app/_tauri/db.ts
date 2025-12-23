import TauriDatabase from '@tauri-apps/plugin-sql';

export interface IDatabase {
    load(path: string): Promise<void>

    execute(query: string, params?: unknown[]): Promise<void>;

    select<T = unknown>(query: string, params?: unknown[]): Promise<T>;
}

let _db: TauriDatabase;
export const DB: IDatabase = {

    async load(path: string): Promise<void> {
        _db = await TauriDatabase.load(path);
    },
    async execute(query: string, params?: unknown[]): Promise<void> {
        await _db.execute(query, params);
    },
    async select<T = unknown>(query: string, params?: unknown[]): Promise<T> {
        return _db.select<T>(query, params);
    }

}
