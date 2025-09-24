import {
    readTextFile as tauriReadTextFile,
    watch as tauriWatch,
    exists as tauriExists, WatchEvent
} from '@tauri-apps/plugin-fs';
import { convertFileSrc as tauriConvertFileSrc } from "@tauri-apps/api/core";
import {Observable} from "rxjs";


type UnwatchFn = () => void;

export const Fs = {

    readTextFile(path: string): Promise<string> {return tauriReadTextFile(path)},

    /** 🆕 Observable-API – preferred */
    watchChanges$(path: string, opts?: { recursive?: boolean }): Observable<void> {
        return new Observable<void>((subscriber) => {
            let unwatch: UnwatchFn | null = null;

            tauriWatch(
                path,
                (event: WatchEvent) => {
                    // Optional: filtern/normalisieren könntest du hier
                    subscriber.next();
                },
                opts
            )
                .then((fn) => (unwatch = fn))
                .catch((err) => subscriber.error(err));

            // Teardown
            return () => {
                try { unwatch?.(); } catch { /* ignore */ }
            };
        });
    },
    exists(path: string): Promise<boolean> {return tauriExists(path)},

    convertFileSrc(path: string): string  {return tauriConvertFileSrc(path)},
}
