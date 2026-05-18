export interface GitBlobReaderContract {
  readBlob(gitRoot: string, rev: string): Promise<string>;
}
