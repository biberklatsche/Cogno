import { join as tauriJoin, homeDir as tauriHomeDir } from '@tauri-apps/api/path';
import {invoke} from "@tauri-apps/api/core";

export const Path = {

    join(...paths: string[]): Promise<string> { return tauriJoin(...paths)},

    homeDir():Promise<string>{return tauriHomeDir()},

    exePath():Promise<string> {return invoke<string>("get_exe_path")},
    exeDir(): Promise<string> {
        return invoke<string>("get_exe_dir");
    },
    macAppBundle(): Promise<string | null> {
        return invoke<string | null>("get_macos_app_bundle");
    }
}
