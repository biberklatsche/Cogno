import { ShellTypeContract } from "@cogno/shared/domain";
import { invoke } from "@tauri-apps/api/core";

export type Shell = { name: string; path: string; shell_type: ShellTypeContract };

export const Shells = {
  load(): Promise<Shell[]> {
    return invoke<Shell[]>("list_shells");
  },
};
