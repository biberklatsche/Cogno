import { ShellContextContract } from "@cogno/core-sdk";
import { BashPathAdapter } from "./bash.path-adapter";
import { FishPathAdapter } from "./fish.path-adapter";
import { GitBashPathAdapter } from "./gitbash.path-adapter";
import { IPathAdapter } from "./path-adapter.interface";
import { PowerShellPathAdapter } from "./powershell.path-adapter";
import { ShellContext } from "./shell-context";
import { ZshPathAdapter } from "./zsh.path-adapter";

export class PathFactory {
    static createAdapter(context: ShellContextContract): IPathAdapter {
        switch (context.shellType) {
            case "Bash":
                return new BashPathAdapter(context as ShellContext);
            case "ZSH":
                return new ZshPathAdapter(context as ShellContext);
            case "Fish":
                return new FishPathAdapter(context as ShellContext);
            case "PowerShell":
                return new PowerShellPathAdapter(context as ShellContext);
            case "GitBash":
                return new GitBashPathAdapter(context as ShellContext);
            default:
                throw new Error(`Unsupported shell type: ${String((context as ShellContext)?.shellType ?? context)}`);
        }
    }
}
