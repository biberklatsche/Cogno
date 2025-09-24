import {
    readTextFile as tauriReadTextFile,
    watch as tauriWatch,
    exists as tauriExists, WatchEvent
} from '@tauri-apps/plugin-fs';


type UnwatchFn = () => void;

export const Fs = {

    readTextFile(path: string): Promise<string> {return tauriReadTextFile(path)},
    watchChanges(path: string, callback: () => void): Promise<UnwatchFn> {
        return tauriWatch(path, (event: WatchEvent) => {
            callback();
        })
    },
    exists(path: string): Promise<boolean> {return tauriExists(path)}
}
