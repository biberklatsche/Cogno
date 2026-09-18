import { Injectable } from "@angular/core";
import { Fs } from "./fs";
import { Paths } from "./path";

/** Plain file access by absolute path, for code that does not go through the shell's path adapter. */
@Injectable({ providedIn: "root" })
export class SimpleFileAccess {
  private readonly paths = new Paths();
  private readonly fs = new Fs();

  async readText(path: string): Promise<string | undefined> {
    if (!(await this.fs.exists(path))) return undefined;
    return this.fs.readTextFile(path);
  }

  writeText(path: string, content: string): Promise<void> {
    return this.fs.writeTextFile(path, content);
  }

  exists(path: string): Promise<boolean> {
    return this.fs.exists(path);
  }

  makeDir(path: string, options?: { recursive?: boolean }): Promise<void> {
    return this.fs.mkdir(path, options);
  }

  homeDir(): Promise<string> {
    return this.paths.homeDir();
  }

  joinPath(...parts: string[]): Promise<string> {
    return this.paths.join(...parts);
  }
}
