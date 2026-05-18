import { GitBlobReaderContract } from "@cogno/core-api";

export abstract class GitBlobReader implements GitBlobReaderContract {
  abstract readBlob(gitRoot: string, rev: string): Promise<string>;
}
