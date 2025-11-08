import {invoke} from "@tauri-apps/api/core";
import {ShellType} from "../config/+models/config.types";

export type Shell = {name: string, path: string, shell_type: ShellType}

export const Shells = {
    load(): Promise<Shell[]> {
        return invoke<Shell[]>("list_shells");
    },
}
