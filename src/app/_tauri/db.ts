import TauriDatabase from '@tauri-apps/plugin-sql';

export interface IDatabase {
  execute(query: string, params?: unknown[]): Promise<void>;
  query<T = unknown>(query: string, params?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
}

export class Database implements IDatabase {
  private db!: TauriDatabase;

  private constructor() {}

  static async create(path: string): Promise<Database> {
    const adapter = new Database();
    adapter.db = await TauriDatabase.load(path);
    return adapter;
  }

  async execute(query: string, bindValues: unknown[] = []): Promise<void> {
    await this.db.execute(query, bindValues);
  }

  async query<T>(query: string, bindValues: unknown[] = []): Promise<T> {
    return this.db.select<T>(query, bindValues);
  }

  async close(): Promise<void> {
    await this.db.close();
  }
}
