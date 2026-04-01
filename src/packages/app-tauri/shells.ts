import {invoke} from "@tauri-apps/api/core";
import {ShellType} from "@cogno/app/config/+models/shell-config";

export type Shell = {name: string, path: string, shell_type: ShellType}

export const Shells = {
    load(): Promise<Shell[]> {
        return invoke<Shell[]>("list_shells");
    },
}
