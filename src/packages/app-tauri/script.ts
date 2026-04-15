import { invoke } from "@tauri-apps/api/core";
import { ShellType } from "../config/+models/config";

export const Script = {
  read(shellType: ShellType): Promise<string> {
    return invoke<string>("get_script", { shellType: shellType });
  },
};
