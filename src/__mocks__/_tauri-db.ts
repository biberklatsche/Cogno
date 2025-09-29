import { vi } from 'vitest';

// Default mock for src/app/_tauri/db.ts
// Mirrors the Database class API with default no-op behavior
class MockDatabase {
  execute = vi.fn(async (_query: string, _params: unknown[] = []) => {});
  query = vi.fn(async <T>(_query: string, _params: unknown[] = []) => [] as unknown as T[]);
  close = vi.fn(async () => {});
}

export class Database extends MockDatabase {
  static async create(_path: string): Promise<Database> {
    return new Database();
  }
}

export type IDatabase = {
  execute(query: string, params?: unknown[]): Promise<void>;
  query<T = unknown>(query: string, params?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
};
