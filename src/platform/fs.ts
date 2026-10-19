import { Injectable } from "@angular/core";
import { convertFileSrc as tauriConvertFileSrc } from "@tauri-apps/api/core";
import {
  DirEntry,
  exists as tauriExists,
  mkdir as tauriMkdir,
  readDir as tauriReadDir,
  readTextFile as tauriReadTextFile,
  watch as tauriWatch,
  writeTextFile as tauriWriteTextFile,
  WatchEvent,
} from "@tauri-apps/plugin-fs";
import { debounceTime, Observable } from "rxjs";
import { fromTauriListener } from "./tauri-listener";

@Injectable({ providedIn: "root" })
export class Fs {
  readTextFile(path: string): Promise<string> {
    return tauriReadTextFile(path);
  }

  writeTextFile(path: string, data: string): Promise<void> {
    return tauriWriteTextFile(path, data);
  }

  mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    return tauriMkdir(path, options);
  }

  readDir(path: string): Promise<DirEntry[]> {
    return tauriReadDir(path);
  }

  /**
   * Emits once per burst of changes under `path`: files created, written,
   * renamed or removed. Reads and attribute changes do not count - a watcher
   * that reacted to its own reads would loop. `*.lock` files are ignored: they
   * are the transient guards of a write in progress (git), not a change.
   */
  watchChanges$(path: string, opts?: { recursive?: boolean; delayMs?: number }): Observable<void> {
    return fromTauriListener<void>((emit) =>
      tauriWatch(
        path,
        (event: WatchEvent) => {
          if (isContentChange(event) && event.paths.some((changed) => !changed.endsWith(".lock"))) {
            emit();
          }
        },
        { delayMs: 200, ...opts },
      ),
    ).pipe(debounceTime(300));
  }

  exists(path: string): Promise<boolean> {
    return tauriExists(path);
  }

  convertFileSrc(path: string): string {
    return tauriConvertFileSrc(path);
  }
}

function isContentChange(event: WatchEvent): boolean {
  const kind = event.type;
  if (typeof kind !== "object") return false;
  if ("modify" in kind) return kind.modify.kind !== "metadata";
  return "create" in kind || "remove" in kind;
}
