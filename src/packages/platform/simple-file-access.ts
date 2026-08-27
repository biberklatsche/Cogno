import { Injectable } from "@angular/core";
import { Fs } from "./fs";
import { Paths } from "./path";

/** Plain file access by absolute path, for code that does not go through the shell's path adapter. */
@Injectable({ providedIn: "root" })
export class SimpleFileAccess {
  private readonly paths = new Paths();

  async readText(path: string): Promise<string | undefined> {
    if (!(await Fs.exists(path))) return undefined;
    return Fs.readTextFile(path);
  }

  writeText(path: string, content: string): Promise<void> {
    return Fs.writeTextFile(path, content);
  }

  exists(path: string): Promise<boolean> {
    return Fs.exists(path);
  }

  makeDir(path: string, options?: { recursive?: boolean }): Promise<void> {
    return Fs.mkdir(path, options);
  }

  homeDir(): Promise<string> {
    return this.paths.homeDir();
  }

  joinPath(...parts: string[]): Promise<string> {
    return this.paths.join(...parts);
  }
}
