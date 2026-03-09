import { Injectable } from "@angular/core";
import { readDir } from "@tauri-apps/plugin-fs";
import {
  FilesystemContract,
  FilesystemEntryContract,
  FilesystemListOptionsContract,
  ShellContextContract,
} from "@cogno/core-sdk";
import { Fs } from "../_tauri/fs";
import { AutocompletePathUtil } from "../terminal/+state/advanced/autocomplete/autocomplete-path.util";
import { PathFactory } from "../terminal/+state/advanced/adapter/path.factory";

@Injectable({ providedIn: "root" })
export class FilesystemHostService implements FilesystemContract {
  normalizePath(path: string, shellContext: ShellContextContract): string {
    return PathFactory.createAdapter(shellContext as never).normalize(path);
  }

  resolvePath(cwd: string, inputPath: string, shellContext: ShellContextContract): string | undefined {
    const adapter = PathFactory.createAdapter(shellContext as never);
    const absoluteLike = inputPath.startsWith("/") || /^[a-zA-Z]:/.test(inputPath) || inputPath.startsWith("\\\\");

    try {
      if (absoluteLike) {
        return adapter.normalize(inputPath);
      }

      const cwdBackend = adapter.render(cwd, { purpose: "backend_fs" });
      if (!cwdBackend) return undefined;
      const sep = cwdBackend.includes("\\") ? "\\" : "/";
      const joined = cwdBackend.endsWith(sep) ? `${cwdBackend}${inputPath}` : `${cwdBackend}${sep}${inputPath}`;
      return adapter.normalize(joined);
    } catch {
      return undefined;
    }
  }

  async list(
    path: string,
    shellContext: ShellContextContract,
    options?: FilesystemListOptionsContract,
  ): Promise<ReadonlyArray<FilesystemEntryContract>> {
    const adapter = PathFactory.createAdapter(shellContext as never);
    const backendPath = adapter.render(path, { purpose: "backend_fs" });
    if (!backendPath) return [];

    const entries = await readDir(backendPath);
    const result: FilesystemEntryContract[] = [];
    const sep = backendPath.includes("\\") ? "\\" : "/";

    for (const entry of entries) {
      const kind = entry.isDirectory ? "directory" : entry.isFile ? "file" : undefined;
      if (!kind) continue;
      if (options?.directoriesOnly && kind !== "directory") continue;
      if (options?.filesOnly && kind !== "file") continue;

      const childBackend = backendPath.endsWith(sep) ? `${backendPath}${entry.name}` : `${backendPath}${sep}${entry.name}`;
      let normalizedPath: string;
      try {
        normalizedPath = adapter.normalize(childBackend);
      } catch {
        continue;
      }

      result.push({
        name: entry.name,
        path: normalizedPath,
        kind,
      });
    }

    return result;
  }

  async exists(path: string, shellContext: ShellContextContract): Promise<boolean> {
    const backendPath = PathFactory.createAdapter(shellContext as never).render(path, { purpose: "backend_fs" });
    return backendPath ? Fs.exists(backendPath) : false;
  }

  async readTextFile(path: string, shellContext: ShellContextContract): Promise<string> {
    const backendPath = PathFactory.createAdapter(shellContext as never).render(path, { purpose: "backend_fs" });
    if (!backendPath) {
      throw new Error(`Unable to render filesystem path '${path}'.`);
    }
    return Fs.readTextFile(backendPath);
  }

  toDisplayPath(path: string, cwd: string, shellContext: ShellContextContract): string {
    return AutocompletePathUtil.toDisplayPath(path, cwd, shellContext as never);
  }

  toRelativePath(path: string, cwd: string, shellContext: ShellContextContract): string {
    return AutocompletePathUtil.toRelativePath(path, cwd);
  }
}
