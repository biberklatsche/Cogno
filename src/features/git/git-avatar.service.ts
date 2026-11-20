import { Injectable, isDevMode, signal } from "@angular/core";
import { bytesToBase64, Fs, Paths } from "@cogno/platform";

/** Pixels requested: twice the commit panel's avatar, for high-density screens. */
const AVATAR_SIZE = 56;
/** The feature's folder in the Cogno home, and the file the avatars are kept in. */
const CACHE_DIR = "git";
const CACHE_FILE = "avatars.json";
/** A kept avatar older than this is still shown, and fetched anew meanwhile. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SAVE_DELAY_MS = 1000;

/** An avatar as kept on disk, under the hash of its email. */
type KeptAvatar = { readonly dataUrl: string; readonly fetchedAt: number };

/**
 * Avatars for the commit graph, from Gravatar by the author's email like
 * GitKraken: the picture the author registered there, or else one Gravatar
 * generates from the email hash so every author has a distinct icon.
 *
 * Gravatar lets a picture be cached for five minutes only, so each start would
 * load every avatar again. The pictures are kept in the Cogno home instead,
 * under the email hash, and shown from there at once; one older than a week
 * is fetched anew in the background. Until a picture is there, `url` answers
 * null and the caller shows the author's initials. One that cannot be
 * fetched, offline say, stays off for the session.
 */
@Injectable({ providedIn: "root" })
export class GitAvatarService {
  /** The URL per email once known; null when there is none to show. */
  private readonly urls = signal<ReadonlyMap<string, string | null>>(new Map());
  private readonly pending = new Set<string>();
  private kept: Promise<Map<string, KeptAvatar>> | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly fs: Fs,
    private readonly paths: Paths,
  ) {}

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
    void this.resolve(email, normalized);
  }

  private async resolve(email: string, normalized: string): Promise<void> {
    const hash = await sha256Hex(normalized);
    const kept = (await this.loadKept()).get(hash);
    // The kept one shows first, so a fresh one fetched meanwhile replaces it, never the other way round.
    if (kept) this.remember(email, kept.dataUrl);
    if (kept && Date.now() - kept.fetchedAt < MAX_AGE_MS) return;
    const fresh = await this.download(hash);
    if (fresh || !kept) this.remember(email, fresh);
  }

  private async download(hash: string): Promise<string | null> {
    try {
      const response = await fetch(
        `https://www.gravatar.com/avatar/${hash}?s=${AVATAR_SIZE}&d=retro`,
      );
      if (!response.ok) return null;
      const type = response.headers.get("content-type") ?? "image/png";
      const bytes = new Uint8Array(await response.arrayBuffer());
      const dataUrl = `data:${type};base64,${bytesToBase64(bytes)}`;
      (await this.loadKept()).set(hash, { dataUrl, fetchedAt: Date.now() });
      this.scheduleSave();
      return dataUrl;
    } catch {
      return null;
    }
  }

  private loadKept(): Promise<Map<string, KeptAvatar>> {
    this.kept ??= this.readKept();
    return this.kept;
  }

  private async readKept(): Promise<Map<string, KeptAvatar>> {
    try {
      // A missing or broken file fails here and starts empty.
      const path = await this.cacheFilePath();
      const stored = JSON.parse(await this.fs.readTextFile(path)) as Record<string, unknown>;
      return new Map(
        Object.entries(stored).filter((entry): entry is [string, KeptAvatar] => isKept(entry[1])),
      );
    } catch {
      return new Map();
    }
  }

  /** Writes once a burst of downloads has settled, not once per avatar. */
  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.save();
    }, SAVE_DELAY_MS);
  }

  private async save(): Promise<void> {
    try {
      const kept = await this.loadKept();
      const path = await this.cacheFilePath();
      await this.fs.mkdir(await this.paths.dirname(path), { recursive: true });
      await this.fs.writeTextFile(path, JSON.stringify(Object.fromEntries(kept)));
    } catch {
      // Not kept this time; the avatars are fetched again on the next start.
    }
  }

  private async cacheFilePath(): Promise<string> {
    const home = await this.paths.cognoHomeDir(isDevMode());
    return this.paths.join(home, CACHE_DIR, CACHE_FILE);
  }

  private remember(email: string, url: string | null): void {
    this.pending.delete(email);
    this.urls.update((urls) => new Map(urls).set(email, url));
  }
}

function isKept(value: unknown): value is KeptAvatar {
  const kept = value as Partial<KeptAvatar> | null;
  return typeof kept?.dataUrl === "string" && typeof kept.fetchedAt === "number";
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
