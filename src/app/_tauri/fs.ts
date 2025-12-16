import {
    writeTextFile as tauriWriteTextFile,
    readTextFile as tauriReadTextFile,
    watch as tauriWatch,
    exists as tauriExists, WatchEvent
} from '@tauri-apps/plugin-fs';
import { convertFileSrc as tauriConvertFileSrc } from "@tauri-apps/api/core";
import {debounceTime, Observable, tap} from "rxjs";


type UnwatchFn = () => void;

export const Fs = {

    readTextFile(path: string): Promise<string> {return tauriReadTextFile(path)},
    writeTextFile(path: string, data: string): Promise<void> {return tauriWriteTextFile(path, data)},
    appendTextFile(path: string, data: string): Promise<void> {return tauriWriteTextFile(path, data, {append: true})},

    watchChanges$(path: string, opts?: { recursive?: boolean, delayMs?: number }): Observable<void> {
        return new Observable<void>((subscriber) => {
            let unwatch: UnwatchFn | null = null;

            tauriWatch(
                path,
                (event: WatchEvent) => {
                    if(typeof event.type === "object" &&
                        "modify" in event.type && (event.type.modify.kind === 'data' || event.type.modify.kind === 'any')
                    ) {
                        subscriber.next();
                    }
                },
                opts
            )
                .then((fn) => (unwatch = fn))
                .catch((err) => subscriber.error(err));

            // Teardown
            return () => {
                try { unwatch?.(); } catch { /* ignore */ }
            };
        }).pipe(debounceTime(500));
    },
    exists(path: string): Promise<boolean> {return tauriExists(path)},

    convertFileSrc(path: string): string  {return tauriConvertFileSrc(path)},
}
