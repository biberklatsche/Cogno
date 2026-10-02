export type ShellTypeContract = "PowerShell" | "ZSH" | "Bash";

export type BackendOsContract = "windows" | "linux" | "macos";

export type ShellContextContract = {
  readonly backendOs: BackendOsContract;
  readonly shellType: ShellTypeContract;
  readonly wslDistroName?: string;
};
