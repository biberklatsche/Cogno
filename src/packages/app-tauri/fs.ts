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

type UnwatchFn = () => void;

export const Fs = {
  readTextFile(path: string): Promise<string> {
    return tauriReadTextFile(path);
  },
  writeTextFile(path: string, data: string): Promise<void> {
    return tauriWriteTextFile(path, data);
  },
  appendTextFile(path: string, data: string): Promise<void> {
    return tauriWriteTextFile(path, data, { append: true });
  },
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    return tauriMkdir(path, options);
  },
  readDir(path: string): Promise<DirEntry[]> {
    return tauriReadDir(path);
  },
  watchChanges$(path: string, opts?: { recursive?: boolean; delayMs?: number }): Observable<void> {
    return new Observable<void>((subscriber) => {
      let unwatch: UnwatchFn | null = null;

      tauriWatch(
        path,
        (event: WatchEvent) => {
          if (
            typeof event.type === "object" &&
            "modify" in event.type &&
            (event.type.modify.kind === "data" || event.type.modify.kind === "any")
          ) {
            subscriber.next();
          }
        },
        opts,
      )
        .then((fn) => (unwatch = fn))
        .catch((err) => subscriber.error(err));

      return () => {
        try {
          unwatch?.();
        } catch {}
      };
    }).pipe(debounceTime(500));
  },
  exists(path: string): Promise<boolean> {
    return tauriExists(path);
  },
  convertFileSrc(path: string): string {
    return tauriConvertFileSrc(path);
  },
};
