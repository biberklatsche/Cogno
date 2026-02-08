import {ShellType} from "../../../../config/+models/shell-config";
import {OsType} from "../../../../_tauri/os";

export type ParseContext = {
    /** Required for WSL normalization; read from env (WSL_DISTRO_NAME) and store in session state */
    wslDistroName?: string; // e.g. "Ubuntu"
};

export type RenderPurpose =
    | "display"
    | "insert_arg"
    | "backend_fs";

export type RenderContext = {
    purpose: RenderPurpose;

    /** OS where your backend (Tauri/Rust) runs */
    backendOs?: OsType;

    /** quoting for insert_arg */
    quoteMode?: "never" | "if-needed" | "always";

    /** WSL distro for rendering //wsl/<distro>/... into a plain linux path in that session */
    wslDistroName?: string;
};

export interface IPathAdapter {
    shellType: ShellType;
    normalize(input: string): string;
    render(cognoPath: string, ctx: RenderContext): string | undefined;
}
