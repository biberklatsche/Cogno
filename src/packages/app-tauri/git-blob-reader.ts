import { invoke } from "@tauri-apps/api/core";

export async function readGitBlob(gitRoot: string, rev: string): Promise<string> {
  try {
    return await invoke<string>("git_read_blob", { gitRoot, rev });
  } catch {
    return "";
  }
}
