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
    },

    cognoHomeDir(devMode: boolean): Promise<string> {
        return invoke<string>("get_cogno_home_dir", { devMode });
    },
    cognoConfigFilePath(devMode: boolean): Promise<string> {
        return invoke<string>("get_cogno_config_file_path", { devMode });
    },
    cognoDbFilePath(devMode: boolean): Promise<string> {
        return invoke<string>("get_cogno_db_file_path", { devMode });
    }
}
