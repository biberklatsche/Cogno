import {ShellType} from "../../../config/+models/shell-config";
import {IPathAdapter} from "./base/path-adapter.interface";
import {BashPathAdapter} from "./bash/bash.path-adapter";
import {ZshPathAdapter} from "./zsh/zsh.path-adapter";
import {FishPathAdapter} from "./fish/fish.path-adapter";
import {PowerShellPathAdapter} from "./powershell/powershell.path-adapter";
import {GitBashPathAdapter} from "./gitbash/gitbash.path-adapter";

export class PathFactory {
    static createAdapter(shellType: ShellType): IPathAdapter {
        switch (shellType) {
            case "Bash":
                return new BashPathAdapter();
            case "ZSH":
                return new ZshPathAdapter();
            case "Fish":
                return new FishPathAdapter();
            case "PowerShell":
                return new PowerShellPathAdapter();
            case "GitBash":
                return new GitBashPathAdapter();
            default:
                throw new Error(`Unsupported shell type: ${shellType}`);
        }
    }
}
