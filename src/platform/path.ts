import { Injectable } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";
import {
  dirname as tauriDirname,
  homeDir as tauriHomeDir,
  join as tauriJoin,
} from "@tauri-apps/api/path";

@Injectable({ providedIn: "root" })
export class Paths {
  join(...paths: string[]): Promise<string> {
    return tauriJoin(...paths);
  }

  dirname(path: string): Promise<string> {
    return tauriDirname(path);
  }

  homeDir(): Promise<string> {
    return tauriHomeDir();
  }

  cognoHomeDir(devMode: boolean): Promise<string> {
    return invoke<string>("get_cogno_home_dir", { devMode });
  }

  cognoConfigFilePath(devMode: boolean): Promise<string> {
    return invoke<string>("get_cogno_config_file_path", { devMode });
  }

  cognoDbFilePath(devMode: boolean): Promise<string> {
    return invoke<string>("get_cogno_db_file_path", { devMode });
  }

  cognoLogFilePath(): Promise<string> {
    return invoke<string>("get_cogno_log_file_path");
  }

  /** The hook scripts Cogno keeps for coding agents, one per shell. */
  agentHookScriptPaths(devMode: boolean): Promise<AgentHookScriptPaths> {
    return invoke<AgentHookScriptPaths>("get_agent_hook_script_paths", { devMode });
  }
}

export type AgentHookScriptPaths = {
  readonly bash: string;
  readonly powershell: string;
};
