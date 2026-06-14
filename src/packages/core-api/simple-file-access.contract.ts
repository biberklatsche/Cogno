export abstract class SimpleFileAccess {
  abstract readText(path: string): Promise<string | undefined>;
  abstract writeText(path: string, content: string): Promise<void>;
  abstract exists(path: string): Promise<boolean>;
  abstract makeDir(path: string, options?: { recursive?: boolean }): Promise<void>;
  abstract homeDir(): Promise<string>;
  abstract joinPath(...parts: string[]): Promise<string>;
}
