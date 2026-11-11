export type ShellTypeContract = "PowerShell" | "ZSH" | "Bash";

export type BackendOsContract = "windows" | "linux" | "macos";

export type ShellContextContract = {
  readonly backendOs: BackendOsContract;
  readonly shellType: ShellTypeContract;
  readonly wslDistroName?: string;
  /**
   * The machine the shell runs on, by its name in `remote.hosts`; left out
   * for the machine Cogno runs on. Paths of such a context are that
   * machine's: nothing on this one may be opened or run with them.
   */
  readonly host?: string;
};
