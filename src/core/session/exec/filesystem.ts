import type { ShellContextContract } from "@cogno/shared/domain";
import type { Observable } from "rxjs";

type FilesystemEntryKindContract = "file" | "directory";

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

/** The session's view of the file system; the DI token, implemented by `FilesystemHostService`. */
export abstract class Filesystem {
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
  abstract watch$(path: string, shellContext: ShellContextContract): Observable<void>;
  abstract toDisplayPath(path: string, cwd: string, shellContext: ShellContextContract): string;
  abstract appendPathSeparator(path: string, shellContext: ShellContextContract): string;
}
