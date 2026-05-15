export abstract class GitBlobReader {
  abstract readBlob(gitRoot: string, rev: string): Promise<string>;
}
