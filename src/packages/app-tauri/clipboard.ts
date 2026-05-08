import { invoke } from "@tauri-apps/api/core";
import { remove } from "@tauri-apps/plugin-fs";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";

const PASTE_FILE_TTL_MS = 60_000;

async function saveImageBlobToFile(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // Encode to base64 in chunks to avoid call stack overflow on large images
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  const base64Data = btoa(binary);
  const extension = blob.type === "image/jpeg" ? "jpg" : "png";

  const filePath = await invoke<string>("save_clipboard_image_to_file", { base64Data, extension });

  // Auto-delete after TTL — long enough for Claude to read the file
  setTimeout(() => {
    remove(filePath).catch(() => undefined);
  }, PASTE_FILE_TTL_MS);

  return filePath;
}

export const Clipboard = {
  async writeText(text: string) {
    return await writeText(text);
  },

  async readText(): Promise<string> {
    return await readText();
  },

  async readImageFromPasteEvent(clipboardData: DataTransfer | null): Promise<string | null> {
    if (!clipboardData) return null;
    for (const item of Array.from(clipboardData.items)) {
      if (item.type.startsWith("image/")) {
        const blob = item.getAsFile();
        if (blob) {
          return await saveImageBlobToFile(blob);
        }
      }
    }
    return null;
  },
};
