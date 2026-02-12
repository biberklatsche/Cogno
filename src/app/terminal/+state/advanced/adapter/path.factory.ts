import {IPathAdapter} from "./base/path-adapter.interface";
import {BashPathAdapter} from "./bash/bash.path-adapter";
import {ZshPathAdapter} from "./zsh/zsh.path-adapter";
import {FishPathAdapter} from "./fish/fish.path-adapter";
import {PowerShellPathAdapter} from "./powershell/powershell.path-adapter";
import {GitBashPathAdapter} from "./gitbash/gitbash.path-adapter";
import {OS} from "../../../../_tauri/os";
import {ShellContext} from "../data/models";

export class PathFactory {
    static createAdapter(context: ShellContext): IPathAdapter {
        switch (context.shellType) {
            case "Bash":
                return new BashPathAdapter({backendOs: OS.platform()});
            case "ZSH":
                return new ZshPathAdapter({backendOs: OS.platform()});
            case "Fish":
                return new FishPathAdapter({backendOs: OS.platform()});
            case "PowerShell":
                return new PowerShellPathAdapter({backendOs: OS.platform()});
            case "GitBash":
                return new GitBashPathAdapter({backendOs: OS.platform()});
            default:
                throw new Error(`Unsupported shell type: ${context}`);
        }
    }
}
