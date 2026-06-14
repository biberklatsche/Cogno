import { Injectable } from "@angular/core";
import { SimpleFileAccess } from "@cogno/core-api";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";

export class ConfigFileError extends Error {
  constructor(
    message: string,
    public readonly path: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ConfigFileError";
  }
}

@Injectable({ providedIn: "root" })
export class ConfigFileService {
  constructor(private readonly fs: SimpleFileAccess) {}

  async readJson<T>(path: string, fallback: T): Promise<T> {
    const raw = await this.fs.readText(path).catch((err) => {
      throw new ConfigFileError(`Cannot read ${path}`, path, err);
    });
    if (raw === undefined) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch (err) {
      throw new ConfigFileError(`Cannot parse JSON from ${path}: ${String(err)}`, path, err);
    }
  }

  async writeJson(path: string, data: unknown): Promise<void> {
    await this.fs.writeText(path, JSON.stringify(data, null, 2)).catch((err) => {
      throw new ConfigFileError(`Cannot write ${path}`, path, err);
    });
  }

  async readToml<T>(path: string, fallback: T): Promise<T> {
    const raw = await this.fs.readText(path).catch((err) => {
      throw new ConfigFileError(`Cannot read ${path}`, path, err);
    });
    if (raw === undefined) return fallback;
    try {
      return parseToml(raw) as T;
    } catch (err) {
      throw new ConfigFileError(`Cannot parse TOML from ${path}: ${String(err)}`, path, err);
    }
  }

  async writeToml(path: string, data: unknown): Promise<void> {
    let raw: string;
    try {
      raw = stringifyToml(data as Parameters<typeof stringifyToml>[0]);
    } catch (err) {
      throw new ConfigFileError(`Cannot serialize TOML for ${path}`, path, err);
    }
    await this.fs.writeText(path, raw).catch((err) => {
      throw new ConfigFileError(`Cannot write ${path}`, path, err);
    });
  }

  exists(path: string): Promise<boolean> {
    return this.fs.exists(path);
  }

  async ensureDir(path: string): Promise<void> {
    if (!(await this.fs.exists(path))) {
      await this.fs.makeDir(path, { recursive: true });
    }
  }

  homeDir(): Promise<string> {
    return this.fs.homeDir();
  }

  joinPath(...parts: string[]): Promise<string> {
    return this.fs.joinPath(...parts);
  }
}
