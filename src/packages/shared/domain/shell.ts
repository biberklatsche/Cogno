export type ShellTypeContract = "PowerShell" | "ZSH" | "Bash";

export type BackendOsContract = "windows" | "linux" | "macos";

export type ShellContextContract = {
  readonly backendOs: BackendOsContract;
  readonly shellType: ShellTypeContract;
  readonly wslDistroName?: string;
};

export type FilesystemEntryKindContract = "file" | "directory";

export interface FilesystemEntryContract {
  readonly name: string;
  readonly path: string;
  readonly kind: FilesystemEntryKindContract;
}

export interface FilesystemListOptionsContract {
  readonly directoriesOnly?: boolean;
  readonly filesOnly?: boolean;
  readonly query?: string;
  readonly limit?: number;
}
