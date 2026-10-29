import { Injectable } from "@angular/core";
import { Fs, Paths } from "@cogno/platform";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";

/** The agents' config files under the home directory, as JSON or TOML. */
@Injectable({ providedIn: "root" })
export class ConfigFileService {
  constructor(
    private readonly fs: Fs,
    private readonly paths: Paths,
  ) {}

  /** `~/<subDir>`, where an agent keeps its config. */
  async configDir(subDir: string): Promise<string> {
    return this.paths.join(await this.paths.homeDir(), subDir);
  }

  /** `~/<subDir>/<fileName>`. */
  async configPath(subDir: string, fileName: string): Promise<string> {
    return this.paths.join(await this.configDir(subDir), fileName);
  }

  async readJson<T>(path: string, fallback: T): Promise<T> {
    const raw = await this.readText(path);
    if (raw === undefined) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch (err) {
      throw new Error(`Cannot parse JSON from ${path}: ${String(err)}`, { cause: err });
    }
  }

  writeJson(path: string, data: unknown): Promise<void> {
    return this.writeText(path, JSON.stringify(data, null, 2));
  }

  async readToml<T>(path: string, fallback: T): Promise<T> {
    const raw = await this.readText(path);
    if (raw === undefined) return fallback;
    try {
      return parseToml(raw) as T;
    } catch (err) {
      throw new Error(`Cannot parse TOML from ${path}: ${String(err)}`, { cause: err });
    }
  }

  async writeToml(path: string, data: unknown): Promise<void> {
    let raw: string;
    try {
      raw = stringifyToml(data as Parameters<typeof stringifyToml>[0]);
    } catch (err) {
      throw new Error(`Cannot serialize TOML for ${path}`, { cause: err });
    }
    await this.writeText(path, raw);
  }

  exists(path: string): Promise<boolean> {
    return this.fs.exists(path);
  }

  async ensureDir(path: string): Promise<void> {
    if (!(await this.fs.exists(path))) {
      await this.fs.mkdir(path, { recursive: true });
    }
  }

  /** The file's text, or undefined when there is no such file. */
  private async readText(path: string): Promise<string | undefined> {
    try {
      if (!(await this.fs.exists(path))) return undefined;
      return await this.fs.readTextFile(path);
    } catch (err) {
      throw new Error(`Cannot read ${path}`, { cause: err });
    }
  }

  private async writeText(path: string, content: string): Promise<void> {
    try {
      await this.fs.writeTextFile(path, content);
    } catch (err) {
      throw new Error(`Cannot write ${path}`, { cause: err });
    }
  }
}
