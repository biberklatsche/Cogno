import { Injectable } from "@angular/core";
import { Fs } from "@cogno/app-tauri/fs";
import { Path } from "@cogno/app-tauri/path";
import { SimpleFileAccess } from "@cogno/core-api";

@Injectable({ providedIn: "root" })
export class SimpleFileAccessAdapterService extends SimpleFileAccess {
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

  async makeDir(path: string, options?: { recursive?: boolean }): Promise<void> {
    return Fs.mkdir(path, options);
  }

  homeDir(): Promise<string> {
    return Path.homeDir();
  }

  joinPath(...parts: string[]): Promise<string> {
    return Path.join(...parts);
  }
}
