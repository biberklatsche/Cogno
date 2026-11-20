import { Injectable, isDevMode, signal } from "@angular/core";
import { bytesToBase64, Fs, Paths } from "@cogno/platform";

/** Pixels requested: twice the commit panel's avatar, for high-density screens. */
const AVATAR_SIZE = 56;
/** The feature's folder in the Cogno home, and the file the avatars are kept in. */
const CACHE_DIR = "git";
const CACHE_FILE = "avatars.json";
/** A kept avatar older than this is still shown, and fetched anew meanwhile. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/**
 * A kept avatar not fetched again for this long is dropped from the file:
 * its author was not shown for weeks. Together with the cap on how many are
 * kept, this keeps the file small however many repositories pass through.
 */
const KEEP_FOR_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_KEPT = 2000;
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
 * fetched, offline say, stays off for the session; one that cannot be shown
 * is dropped from the file too, so it is fetched again next time.
 *
 * Gravatar answers with `Access-Control-Allow-Origin: *`, which `fetch` from
 * the webview needs. Avatars fetched in the second before the app closes are
 * not written; they are fetched again on the next start.
 */
@Injectable({ providedIn: "root" })
export class GitAvatarService {
  /**
   * The URL per email once known, null when there is none to show. Keyed by
   * the email as Gravatar hashes it, so spellings that differ only in case or
   * spaces share one entry and one download.
   */
  private readonly urls = signal<ReadonlyMap<string, string | null>>(new Map());
  private readonly pending = new Set<string>();
  /** Dropped in this session; another window's copy on disk does not bring them back. */
  private readonly dropped = new Set<string>();
  private kept: Promise<Map<string, KeptAvatar>> | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  /** The write in progress; the next one waits for it, so two never overlap. */
  private saving: Promise<void> = Promise.resolve();

  constructor(
    private readonly fs: Fs,
    private readonly paths: Paths,
  ) {}

  url(email: string): string | null {
    const key = normalize(email);
    if (!key) return null;
    const known = this.urls().get(key);
    if (known !== undefined) return known;
    if (!this.pending.has(key)) {
      this.pending.add(key);
      void this.resolve(key);
    }
    return null;
  }

  /** The picture of `email` could not be shown: none for this session, and gone from the file. */
  markFailed(email: string): void {
    const key = normalize(email);
    this.remember(key, null);
    void sha256Hex(key)
      .then(async (hash) => {
        this.dropped.add(hash);
        if ((await this.loadKept()).delete(hash)) this.scheduleSave();
      })
      .catch(() => undefined);
  }

  private async resolve(key: string): Promise<void> {
    try {
      const hash = await sha256Hex(key);
      const kept = (await this.loadKept()).get(hash);
      // The kept one shows first, so a fresh one fetched meanwhile replaces it, never the other way round.
      if (kept) this.remember(key, kept.dataUrl);
      if (kept && Date.now() - kept.fetchedAt < MAX_AGE_MS) return;
      const fresh = await this.download(hash);
      if (fresh || !kept) this.remember(key, fresh);
    } catch {
      this.remember(key, null);
    }
  }

  /** The picture as a data URL, kept for next time; null when there is no picture to have. */
  private async download(hash: string): Promise<string | null> {
    try {
      const response = await fetch(
        `https://www.gravatar.com/avatar/${hash}?s=${AVATAR_SIZE}&d=retro`,
      );
      if (!response.ok) return null;
      // A portal or proxy may answer with a page instead; only a picture is kept.
      const type = (response.headers.get("content-type") ?? "image/png")
        .split(";")[0]
        ?.trim()
        .toLowerCase();
      if (!type?.startsWith("image/")) return null;
      const bytes = new Uint8Array(await response.arrayBuffer());
      const dataUrl = `data:${type};base64,${bytesToBase64(bytes)}`;
      (await this.loadKept()).set(hash, { dataUrl, fetchedAt: Date.now() });
      this.dropped.delete(hash);
      this.scheduleSave();
      return dataUrl;
    } catch {
      return null;
    }
  }

  private loadKept(): Promise<Map<string, KeptAvatar>> {
    this.kept ??= this.readFile();
    return this.kept;
  }

  /** What the file holds; empty when it is missing or broken. */
  private async readFile(): Promise<Map<string, KeptAvatar>> {
    try {
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
      this.saving = this.saving.then(() => this.save());
    }, SAVE_DELAY_MS);
  }

  /**
   * Writes the kept avatars, together with what another window wrote
   * meanwhile (the newer of each wins), without those not fetched for weeks
   * and at most `MAX_KEPT`, the newest.
   */
  private async save(): Promise<void> {
    try {
      // Merged for writing only: what other windows kept stays out of this one's memory.
      const merged = new Map(await this.loadKept());
      for (const [hash, avatar] of await this.readFile()) {
        if (this.dropped.has(hash)) continue;
        const own = merged.get(hash);
        if (!own || own.fetchedAt < avatar.fetchedAt) merged.set(hash, avatar);
      }
      const since = Date.now() - KEEP_FOR_MS;
      const written = [...merged]
        .filter(([, avatar]) => avatar.fetchedAt >= since)
        .sort(([, a], [, b]) => b.fetchedAt - a.fetchedAt)
        .slice(0, MAX_KEPT);
      const path = await this.cacheFilePath();
      await this.fs.mkdir(await this.paths.dirname(path), { recursive: true });
      await this.fs.writeTextFile(path, JSON.stringify(Object.fromEntries(written)));
    } catch {
      // Not kept this time; the avatars are fetched again on the next start.
    }
  }

  private async cacheFilePath(): Promise<string> {
    const home = await this.paths.cognoHomeDir(isDevMode());
    return this.paths.join(home, CACHE_DIR, CACHE_FILE);
  }

  private remember(key: string, url: string | null): void {
    this.pending.delete(key);
    this.urls.update((urls) => new Map(urls).set(key, url));
  }
}

/** The email as Gravatar hashes it: trimmed and lower-cased. */
function normalize(email: string): string {
  return email.trim().toLowerCase();
}

function isKept(value: unknown): value is KeptAvatar {
  const kept = value as Partial<KeptAvatar> | null;
  return typeof kept?.dataUrl === "string" && typeof kept.fetchedAt === "number";
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
