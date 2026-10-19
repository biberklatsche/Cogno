import { Injectable, signal } from "@angular/core";

/** Pixels requested: twice the commit panel's avatar, for high-density screens. */
const AVATAR_SIZE = 56;

/**
 * Avatars for the commit graph, from Gravatar by the author's email like
 * GitKraken: the picture the author registered there, or else one Gravatar
 * generates from the email hash so every author has a distinct icon. The URL
 * needs the email hashed first, so it arrives a moment after the first ask.
 * An image that fails to load, offline say, stays off for the session.
 */
@Injectable({ providedIn: "root" })
export class GitAvatarService {
  /** The URL per email once known; null when there is none to show. */
  private readonly urls = signal<ReadonlyMap<string, string | null>>(new Map());
  private readonly pending = new Set<string>();

  url(email: string): string | null {
    const known = this.urls().get(email);
    if (known !== undefined) return known;
    this.request(email);
    return null;
  }

  markFailed(email: string): void {
    this.remember(email, null);
  }

  private request(email: string): void {
    const normalized = email.trim().toLowerCase();
    if (!normalized || this.pending.has(email)) return;
    this.pending.add(email);
    void sha256Hex(normalized).then((hash) => {
      this.remember(email, `https://www.gravatar.com/avatar/${hash}?s=${AVATAR_SIZE}&d=retro`);
    });
  }

  private remember(email: string, url: string | null): void {
    this.pending.delete(email);
    this.urls.update((urls) => new Map(urls).set(email, url));
  }
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
