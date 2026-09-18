import { ShellContextContract } from "./shell";

type BaseShellContextContract = {
  backendOs: ShellContextContract["backendOs"];
  shellType: ShellContextContract["shellType"];
};

export type WslShellContextContract = BaseShellContextContract & {
  wslDistroName: string;
  backendOs: "windows";
  shellType: "Bash" | "ZSH";
};

export type ResolvedShellContextContract = BaseShellContextContract | WslShellContextContract;

export function isWslShellContext(ctx: ShellContextContract): ctx is WslShellContextContract {
  return (
    ctx.backendOs === "windows" &&
    (ctx.shellType === "Bash" || ctx.shellType === "ZSH") &&
    "wslDistroName" in ctx
  );
}
