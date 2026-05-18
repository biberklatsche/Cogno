import { Injectable } from "@angular/core";
import { readGitBlob } from "@cogno/app-tauri/git-blob-reader";
import { GitBlobReaderContract } from "@cogno/core-api";

@Injectable({ providedIn: "root" })
export class GitBlobReaderHostService implements GitBlobReaderContract {
  readBlob(gitRoot: string, rev: string): Promise<string> {
    return readGitBlob(gitRoot, rev);
  }
}
