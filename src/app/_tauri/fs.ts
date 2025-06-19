import {
    readTextFile as tauriReadTextFile,
    watch as tauriWatch,
    exists as tauriExists, WatchEvent
} from '@tauri-apps/plugin-fs';


type UnwatchFn = () => void;

export namespace Fs {

    export const readTextFile= (path: string): Promise<string> => tauriReadTextFile(path);
    export const watchChanges= (path: string, callback: () => void): Promise<UnwatchFn> => {
        return tauriWatch(path, (event: WatchEvent) => {
            callback();
        })
    };
    export const exists= (path: string): Promise<boolean> => tauriExists(path);
}
