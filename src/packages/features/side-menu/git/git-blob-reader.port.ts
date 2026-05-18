import { GitBlobReaderContract } from "@cogno/core-api";

export type { GitBlobReaderContract };

export abstract class GitBlobReader implements GitBlobReaderContract {
  abstract readBlob(gitRoot: string, rev: string): Promise<string>;
}
