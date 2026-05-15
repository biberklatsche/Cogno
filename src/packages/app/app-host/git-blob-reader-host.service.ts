import { Injectable } from "@angular/core";
import { readGitBlob } from "@cogno/app-tauri/git-blob-reader";
import { GitBlobReader } from "@cogno/core-api";

@Injectable({ providedIn: "root" })
export class GitBlobReaderHostService extends GitBlobReader {
  readBlob(gitRoot: string, rev: string): Promise<string> {
    return readGitBlob(gitRoot, rev);
  }
}
