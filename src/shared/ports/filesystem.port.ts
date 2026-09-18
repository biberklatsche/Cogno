// Stays in shared/: dual-consumed by core (api/session/workbench suggestor),
// features (autocomplete) and shared/contributions. A contract this widely
// shared cannot move to core/api (step 24f).
import type {
  FilesystemEntryContract,
  FilesystemListOptionsContract,
  ShellContextContract,
} from "@cogno/shared/domain";

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
