import { OsType } from "@cogno/app-tauri/os";
import { ShellType } from "../../../config/+models/config";
import { ShellProfile } from "../../../config/+models/shell-config";
import { ShellContext } from "../advanced/model/models";

export function deriveShellContext(shellType: ShellType, shellProfile: ShellProfile | undefined, backendOs: OsType): ShellContext {
    if (backendOs !== "windows") {
        return { shellType, backendOs };
    }

    if (!(shellType === "Bash" || shellType === "ZSH" || shellType === "Fish")) {
        return { shellType, backendOs };
    }

    const distro = extractWslDistro(shellProfile);
    if (!distro) {
        return { shellType, backendOs };
    }

    return { shellType, backendOs, wslDistroName: distro };
}

function extractWslDistro(shellProfile: ShellProfile | undefined): string | undefined {
    if (!shellProfile) return undefined;
    if (!isWslLauncher(shellProfile.path)) return undefined;

    const env = shellProfile.env ?? {};
    const envDistro = env["WSL_DISTRO_NAME"] || env["COGNO_WSL_DISTRO"];
    if (envDistro && envDistro.trim()) return envDistro.trim();

    const args = shellProfile.args ?? [];
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if ((arg === "-d" || arg === "--distribution") && args[i + 1]?.trim()) {
            return args[i + 1].trim();
        }
        const inline = /^--distribution=(.+)$/.exec(arg);
        if (inline?.[1]?.trim()) {
            return inline[1].trim();
        }
    }

    return undefined;
}

function isWslLauncher(path: string | undefined): boolean {
    if (!path) return false;
    const normalized = path.replace(/\\/g, "/").toLowerCase();
    return normalized.endsWith("/wsl.exe") || normalized === "wsl.exe" || normalized.endsWith("/wsl");
}


