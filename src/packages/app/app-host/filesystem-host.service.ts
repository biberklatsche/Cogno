import { Injectable } from "@angular/core";
import { Fs } from "@cogno/app-tauri/fs";
import {
  Filesystem,
  FilesystemEntryContract,
  FilesystemListOptionsContract,
  ShellContextContract,
} from "@cogno/core-api";
import { PathFactory } from "@cogno/core-host";
import { AutocompletePathSupport } from "@cogno/core-support";

@Injectable({ providedIn: "root" })
export class FilesystemHostService extends Filesystem {
  normalizePath(path: string, shellContext: ShellContextContract): string {
    return PathFactory.createAdapter(shellContext).normalize(path);
  }

  resolvePath(
    cwd: string,
    inputPath: string,
    shellContext: ShellContextContract,
  ): string | undefined {
    const adapter = PathFactory.createAdapter(shellContext);
    const absoluteLike =
      inputPath.startsWith("/") || /^[a-zA-Z]:/.test(inputPath) || inputPath.startsWith("\\\\");

    try {
      if (absoluteLike) {
        return adapter.normalize(inputPath);
      }

      const cwdBackend = adapter.render(cwd, { purpose: "backend_fs" });
      if (!cwdBackend) return undefined;
      const sep = cwdBackend.includes("\\") ? "\\" : "/";
      const joined = cwdBackend.endsWith(sep)
        ? `${cwdBackend}${inputPath}`
        : `${cwdBackend}${sep}${inputPath}`;
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
    const adapter = PathFactory.createAdapter(shellContext);
    const backendPath = adapter.render(path, { purpose: "backend_fs" });
    if (!backendPath) return [];

    const entries = await Fs.readDir(backendPath);
    const prefixMatches: FilesystemEntryContract[] = [];
    const containsMatches: FilesystemEntryContract[] = [];
    const sep = backendPath.includes("\\") ? "\\" : "/";
    const query = options?.query?.trim().toLowerCase() ?? "";
    const limit = Math.max(1, options?.limit ?? Number.MAX_SAFE_INTEGER);

    for (const entry of entries) {
      const kind = entry.isDirectory ? "directory" : entry.isFile ? "file" : undefined;
      if (!kind) continue;
      if (options?.directoriesOnly && kind !== "directory") continue;
      if (options?.filesOnly && kind !== "file") continue;

      const childBackend = backendPath.endsWith(sep)
        ? `${backendPath}${entry.name}`
        : `${backendPath}${sep}${entry.name}`;
      let normalizedPath: string;
      try {
        normalizedPath = adapter.normalize(childBackend);
      } catch {
        continue;
      }

      const candidate = {
        name: entry.name,
        path: normalizedPath,
        kind,
      } satisfies FilesystemEntryContract;

      if (!query) {
        prefixMatches.push(candidate);
        if (prefixMatches.length >= limit) break;
        continue;
      }

      const entryNameLower = entry.name.toLowerCase();
      if (entryNameLower.startsWith(query)) {
        prefixMatches.push(candidate);
        continue;
      }
      if (entryNameLower.includes(query)) {
        containsMatches.push(candidate);
      }
    }

    if (!query) {
      return prefixMatches;
    }

    return [...prefixMatches, ...containsMatches].slice(0, limit);
  }

  async exists(path: string, shellContext: ShellContextContract): Promise<boolean> {
    const backendPath = PathFactory.createAdapter(shellContext).render(path, {
      purpose: "backend_fs",
    });
    return backendPath ? Fs.exists(backendPath) : false;
  }

  async readTextFile(path: string, shellContext: ShellContextContract): Promise<string> {
    const backendPath = PathFactory.createAdapter(shellContext).render(path, {
      purpose: "backend_fs",
    });
    if (!backendPath) {
      throw new Error(`Unable to render filesystem path '${path}'.`);
    }
    return Fs.readTextFile(backendPath);
  }

  toDisplayPath(path: string, cwd: string, shellContext: ShellContextContract): string {
    return AutocompletePathSupport.toDisplayPath(
      path,
      cwd,
      PathFactory.createAdapter(shellContext),
    );
  }

  appendPathSeparator(path: string, shellContext: ShellContextContract): string {
    return AutocompletePathSupport.appendDirectorySeparator(path, shellContext);
  }

  toRelativePath(path: string, cwd: string, _shellContext: ShellContextContract): string {
    return AutocompletePathSupport.toRelativePath(path, cwd);
  }
}
