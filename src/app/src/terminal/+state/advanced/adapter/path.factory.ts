import {IPathAdapter} from "./base/path-adapter.interface";
import {BashPathAdapter} from "./bash/bash.path-adapter";
import {ZshPathAdapter} from "./zsh/zsh.path-adapter";
import {FishPathAdapter} from "./fish/fish.path-adapter";
import {PowerShellPathAdapter} from "./powershell/powershell.path-adapter";
import {GitBashPathAdapter} from "./gitbash/gitbash.path-adapter";
import {ShellContext} from "../model/models";

export class PathFactory {
    static createAdapter(context: ShellContext): IPathAdapter {
        switch (context.shellType) {
            case "Bash":
                return new BashPathAdapter(context);
            case "ZSH":
                return new ZshPathAdapter(context);
            case "Fish":
                return new FishPathAdapter(context);
            case "PowerShell":
                return new PowerShellPathAdapter(context);
            case "GitBash":
                return new GitBashPathAdapter(context);
            default:
                throw new Error(`Unsupported shell type: ${String((context as ShellContext)?.shellType ?? context)}`);
        }
    }
}
