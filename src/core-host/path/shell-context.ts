import { BackendOsContract, ShellContextContract, ShellTypeContract } from "@cogno/core-sdk";

type BaseShellContext = {
    backendOs: BackendOsContract;
    shellType: ShellTypeContract;
};

type WslShellContext = BaseShellContext & {
    wslDistroName: string;
    backendOs: "windows";
    shellType: "Bash" | "ZSH" | "Fish";
};

export type ShellContext = BaseShellContext | WslShellContext;

export function isWslContext(ctx: ShellContextContract): ctx is WslShellContext {
    return ctx.backendOs === "windows"
        && (ctx.shellType === "Bash" || ctx.shellType === "ZSH" || ctx.shellType === "Fish")
        && "wslDistroName" in ctx;
}
