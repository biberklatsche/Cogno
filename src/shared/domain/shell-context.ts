import { ShellContextContract } from "./shell";

type BaseShellContextContract = {
  backendOs: ShellContextContract["backendOs"];
  shellType: ShellContextContract["shellType"];
  host?: ShellContextContract["host"];
};

export type WslShellContextContract = BaseShellContextContract & {
  wslDistroName: string;
  backendOs: "windows";
  shellType: "Bash" | "ZSH";
};

export type ResolvedShellContextContract = BaseShellContextContract | WslShellContextContract;

/** Whether the context's shell runs on another machine than Cogno. */
export function isRemoteShellContext(ctx: ShellContextContract): boolean {
  return ctx.host !== undefined;
}

export function isWslShellContext(ctx: ShellContextContract): ctx is WslShellContextContract {
  return (
    ctx.backendOs === "windows" &&
    (ctx.shellType === "Bash" || ctx.shellType === "ZSH") &&
    "wslDistroName" in ctx
  );
}
