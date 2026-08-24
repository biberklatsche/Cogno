import { Injectable } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";

export async function readGitBlob(gitRoot: string, rev: string): Promise<string> {
  try {
    return await invoke<string>("git_read_blob", { gitRoot, rev });
  } catch {
    return "";
  }
}

@Injectable({ providedIn: "root" })
export class GitBlobReader {
  readBlob(gitRoot: string, rev: string): Promise<string> {
    return readGitBlob(gitRoot, rev);
  }
}
