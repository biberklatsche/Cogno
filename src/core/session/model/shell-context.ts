import { ShellType } from "@cogno/core/infrastructure/config/models/config";
import { ShellProfile } from "@cogno/core/infrastructure/config/models/shell-config";
import { OsType } from "@cogno/platform/os";
import {
  BackendOsContract,
  ResolvedShellContextContract as ShellContext,
  ShellTypeContract,
} from "@cogno/shared/domain";

export function deriveShellContext(
  shellType: ShellType,
  shellProfile: ShellProfile | undefined,
  backendOs: OsType,
): ShellContext {
  if (backendOs !== "windows") {
    return { shellType, backendOs };
  }

  if (!(shellType === "Bash" || shellType === "ZSH")) {
    return { shellType, backendOs };
  }

  const distro = extractWslDistro(shellProfile);
  if (!distro) {
    return { shellType, backendOs };
  }

  return { shellType, backendOs, wslDistroName: distro };
}

/**
 * The shell context a `COGNO:CAPS` handshake describes: its `shell`, `os`
 * and `distro` fields. A distro on a Windows host means WSL (the inner
 * shell reports os=linux via uname, but the path space is the host's WSL
 * mount), so the outer OS wins there; otherwise the reported os is taken at
 * face value. Returns undefined for a shell Cogno has no adapter for - the
 * caller treats that as an unknown context.
 */
export function contextFromHandshake(
  fields: { shell?: string; os?: string; distro?: string },
  outerContext: ShellContext,
): ShellContext | undefined {
  const shellType = HANDSHAKE_SHELL_TYPES[fields.shell?.trim() ?? ""];
  if (!shellType) return undefined;

  const distro = fields.distro?.trim();
  if (
    distro &&
    outerContext.backendOs === "windows" &&
    (shellType === "Bash" || shellType === "ZSH")
  ) {
    return { shellType, backendOs: "windows", wslDistroName: distro };
  }

  const backendOs = HANDSHAKE_BACKEND_OS[fields.os?.trim() ?? ""] ?? outerContext.backendOs;
  return { shellType, backendOs };
}

const HANDSHAKE_SHELL_TYPES: Record<string, ShellTypeContract> = {
  bash: "Bash",
  zsh: "ZSH",
  pwsh: "PowerShell",
  powershell: "PowerShell",
};

const HANDSHAKE_BACKEND_OS: Record<string, BackendOsContract> = {
  linux: "linux",
  macos: "macos",
  windows: "windows",
};

function extractWslDistro(shellProfile: ShellProfile | undefined): string | undefined {
  if (!shellProfile) return undefined;
  if (!isWslLauncher(shellProfile.path)) return undefined;

  const env = shellProfile.env ?? {};
  const envDistro = env["WSL_DISTRO_NAME"] || env["COGNO_WSL_DISTRO"];
  if (envDistro?.trim()) return envDistro.trim();

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
