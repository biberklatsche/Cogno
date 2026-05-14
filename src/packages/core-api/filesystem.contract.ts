export type ShellTypeContract = "PowerShell" | "ZSH" | "Bash" | "GitBash" | "Fish";
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

export interface FilesystemContract {
  normalizePath(path: string, shellContext: ShellContextContract): string;
  resolvePath(
    cwd: string,
    inputPath: string,
    shellContext: ShellContextContract,
  ): string | undefined;
  list(
    path: string,
    shellContext: ShellContextContract,
    options?: FilesystemListOptionsContract,
  ): Promise<ReadonlyArray<FilesystemEntryContract>>;
  exists(path: string, shellContext: ShellContextContract): Promise<boolean>;
  readTextFile(path: string, shellContext: ShellContextContract): Promise<string>;
  toDisplayPath(path: string, cwd: string, shellContext: ShellContextContract): string;
  appendPathSeparator(path: string, shellContext: ShellContextContract): string;
  toRelativePath(path: string, cwd: string, shellContext: ShellContextContract): string;
}

export abstract class Filesystem implements FilesystemContract {
  abstract normalizePath(path: string, shellContext: ShellContextContract): string;
  abstract resolvePath(
    cwd: string,
    inputPath: string,
    shellContext: ShellContextContract,
  ): string | undefined;
  abstract list(
    path: string,
    shellContext: ShellContextContract,
    options?: FilesystemListOptionsContract,
  ): Promise<ReadonlyArray<FilesystemEntryContract>>;
  abstract exists(path: string, shellContext: ShellContextContract): Promise<boolean>;
  abstract readTextFile(path: string, shellContext: ShellContextContract): Promise<string>;
  abstract toDisplayPath(path: string, cwd: string, shellContext: ShellContextContract): string;
  abstract appendPathSeparator(path: string, shellContext: ShellContextContract): string;
  abstract toRelativePath(path: string, cwd: string, shellContext: ShellContextContract): string;
}
