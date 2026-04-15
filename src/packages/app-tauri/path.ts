import { invoke } from "@tauri-apps/api/core";
import {
  dirname as tauriDirname,
  homeDir as tauriHomeDir,
  join as tauriJoin,
} from "@tauri-apps/api/path";

export const Path = {
  join(...paths: string[]): Promise<string> {
    return tauriJoin(...paths);
  },
  dirname(path: string): Promise<string> {
    return tauriDirname(path);
  },

  homeDir(): Promise<string> {
    return tauriHomeDir();
  },

  exePath(): Promise<string> {
    return invoke<string>("get_exe_path");
  },
  exeDir(): Promise<string> {
    return invoke<string>("get_exe_dir");
  },
  macAppBundle(): Promise<string | null> {
    return invoke<string | null>("get_macos_app_bundle");
  },
  systemPath(): Promise<string | null> {
    return invoke<string | null>("get_system_path");
  },

  cognoHomeDir(devMode: boolean): Promise<string> {
    return invoke<string>("get_cogno_home_dir", { devMode });
  },
  cognoConfigFilePath(devMode: boolean): Promise<string> {
    return invoke<string>("get_cogno_config_file_path", { devMode });
  },
  cognoDbFilePath(devMode: boolean): Promise<string> {
    return invoke<string>("get_cogno_db_file_path", { devMode });
  },
};
