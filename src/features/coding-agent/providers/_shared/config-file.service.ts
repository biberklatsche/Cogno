import { Injectable } from "@angular/core";
import { Fs, Paths } from "@cogno/platform";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";

/** Suffix of the copy of an agent's config file as it was before Cogno's last change. */
const BACKUP_SUFFIX = ".cogno-backup";

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

  join(...parts: string[]): Promise<string> {
    return this.paths.join(...parts);
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

  writeJson(path: string, data: unknown): Promise<boolean> {
    return this.replaceText(path, JSON.stringify(data, null, 2));
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

  async writeToml(path: string, data: unknown): Promise<boolean> {
    let raw: string;
    try {
      raw = stringifyToml(data as Parameters<typeof stringifyToml>[0]);
    } catch (err) {
      throw new Error(`Cannot serialize TOML for ${path}`, { cause: err });
    }
    return this.replaceText(path, raw);
  }

  exists(path: string): Promise<boolean> {
    return this.fs.exists(path);
  }

  /** Removes a file, or with `recursive` a directory; nothing to remove is fine. */
  async remove(path: string, options?: { recursive?: boolean }): Promise<void> {
    try {
      if (!(await this.fs.exists(path))) return;
      await this.fs.remove(path, options);
    } catch (err) {
      throw new Error(`Cannot remove ${path}`, { cause: err });
    }
  }

  async ensureDir(path: string): Promise<void> {
    if (!(await this.fs.exists(path))) {
      await this.fs.mkdir(path, { recursive: true });
    }
  }

  /** The file's text, or undefined when there is no such file. */
  async readText(path: string): Promise<string | undefined> {
    try {
      if (!(await this.fs.exists(path))) return undefined;
      return await this.fs.readTextFile(path);
    } catch (err) {
      throw new Error(`Cannot read ${path}`, { cause: err });
    }
  }

  /**
   * Rewrites a config file the agent owns, and says whether it wrote. Unchanged
   * text is not written; changed text first keeps the file's previous text next
   * to it, so a user can get back what Cogno overwrote.
   */
  async replaceText(path: string, content: string): Promise<boolean> {
    const previous = await this.readText(path);
    if (previous === content) return false;
    if (previous !== undefined) await this.write(`${path}${BACKUP_SUFFIX}`, previous);
    await this.write(path, content);
    return true;
  }

  /** Writes a file of Cogno's own, unless it already holds this text; says whether it wrote. */
  async writeText(path: string, content: string): Promise<boolean> {
    if ((await this.readText(path)) === content) return false;
    await this.write(path, content);
    return true;
  }

  private async write(path: string, content: string): Promise<void> {
    try {
      await this.fs.writeTextFile(path, content);
    } catch (err) {
      throw new Error(`Cannot write ${path}`, { cause: err });
    }
  }
}
