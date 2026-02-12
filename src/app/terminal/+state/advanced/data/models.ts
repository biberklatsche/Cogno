import {OsType} from "../../../../_tauri/os";
import {ShellType} from "../../../../config/+models/shell-config";

type BaseShellContext = {
    /** OS where your backend (Tauri/Rust) runs */
    backendOs: OsType;
    shellType: ShellType;
};

type WslShellContext = BaseShellContext & {
    wslDistroName: string;
    backendOs: 'windows';
    shellType: 'Bash' | 'ZSH' | 'Fish';
};

export type ShellContext = BaseShellContext | WslShellContext;

// helper type guard
export function isWslContext(ctx: ShellContext): ctx is WslShellContext {
    return ctx.backendOs === 'windows'
        && (ctx.shellType === 'Bash' || ctx.shellType === 'ZSH' || ctx.shellType === 'Fish')
        && 'wslDistroName' in ctx;
}
