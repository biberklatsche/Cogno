import { invoke } from "@tauri-apps/api/core";
import { readImage, readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { remove } from "@tauri-apps/plugin-fs";

const DEFAULT_PASTE_FILE_TTL_MS = 60_000;

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function rgbaToBlob(rgba: Uint8Array, width: number, height: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Canvas 2D context not available"));
      return;
    }
    ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
      "image/png",
    );
  });
}

async function saveImageBlobToFile(blob: Blob, ttlMs: number): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const base64Data = bytesToBase64(bytes);
  const extension = blob.type === "image/jpeg" ? "jpg" : "png";

  const filePath = await invoke<string>("save_clipboard_image_to_file", { base64Data, extension });

  setTimeout(() => {
    remove(filePath).catch(() => undefined);
  }, ttlMs);

  return filePath;
}

export const Clipboard = {
  async writeText(text: string) {
    return await writeText(text);
  },

  async readText(): Promise<string> {
    return await readText();
  },

  async readImageFromClipboard(ttlMs: number = DEFAULT_PASTE_FILE_TTL_MS): Promise<string | null> {
    try {
      const image = await readImage();
      const [rgba, { width, height }] = await Promise.all([image.rgba(), image.size()]);
      const blob = await rgbaToBlob(new Uint8Array(rgba), width, height);
      return await saveImageBlobToFile(blob, ttlMs);
    } catch {
      return null;
    }
  },
};
