import { Injectable, isDevMode, signal } from "@angular/core";
import { bytesToBase64, Fs, Paths } from "@cogno/platform";

/** Pixels requested: twice the commit panel's avatar, for high-density screens. */
const AVATAR_SIZE = 56;
/**
 * The folder in the Cogno home the avatars are kept in, one file each. Under
 * `cache`, so it is plain that it may be deleted: it fills again on its own.
 */
const AVATAR_DIR = ["cache", "avatars"] as const;
/**
 * A kept avatar's file: the email hash and when it was fetched, so the folder
 * can be sorted and cleared by its names alone. The file holds the data URL.
 */
const FILE_NAME = /^([0-9a-f]{64})-(\d+)\.txt$/;
/** A kept avatar older than this is still shown, and fetched anew meanwhile. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/**
 * A kept avatar not fetched again for this long is cleared out: its author
 * was not shown for weeks. Together with the cap on how many are kept, this
 * keeps the folder small however many repositories pass through.
 */
const KEEP_FOR_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_KEPT = 2000;

/** A kept avatar's file, known by its name; its picture is read only when shown. */
type KeptFile = { readonly name: string; readonly fetchedAt: number };

/**
 * Avatars for the commit graph, from Gravatar by the author's email like
 * GitKraken: the picture the author registered there, or else one Gravatar
 * generates from the email hash so every author has a distinct icon.
 *
 * Gravatar lets a picture be cached for five minutes only, so each start would
 * load every avatar again. The pictures are kept in the Cogno home instead,
 * one file per email hash, and shown from there at once; one older than a
 * week is fetched anew in the background. Only the folder's names are read up
 * front, a picture only when its author is shown. Until a picture is there,
 * `url` answers null and the caller shows the author's initials. One that
 * cannot be fetched, offline say, stays off for the session; one that cannot
 * be shown is removed from disk too, so it is fetched again next time.
 *
 * Gravatar answers with `Access-Control-Allow-Origin: *`, which `fetch` from
 * the webview needs. Each avatar is its own file, so windows never write over
 * each other's avatars.
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
  /** The kept avatars by email hash, read from the folder's names once. */
  private kept: Promise<Map<string, KeptFile>> | null = null;

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

  /** The picture of `email` could not be shown: none for this session, and gone from disk. */
  markFailed(email: string): void {
    const key = normalize(email);
    this.remember(key, null);
    void sha256Hex(key)
      .then(async (hash) => {
        const kept = await this.loadKept();
        const file = kept.get(hash);
        if (!file) return;
        kept.delete(hash);
        await this.removeFile(file.name);
      })
      .catch(() => undefined);
  }

  private async resolve(key: string): Promise<void> {
    try {
      const hash = await sha256Hex(key);
      const file = (await this.loadKept()).get(hash);
      const shown = file ? await this.readPicture(file) : null;
      // The kept one shows first, so a fresh one fetched meanwhile replaces it, never the other way round.
      if (shown) this.remember(key, shown);
      if (shown && file && Date.now() - file.fetchedAt < MAX_AGE_MS) return;
      const fresh = await this.download(hash);
      if (fresh) await this.keep(hash, fresh);
      if (fresh || !shown) this.remember(key, fresh);
    } catch {
      this.remember(key, null);
    }
  }

  /** The picture as a data URL; null when there is no picture to have. */
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
      return `data:${type};base64,${bytesToBase64(bytes)}`;
    } catch {
      return null;
    }
  }

  /** Writes the picture as the hash's new file and removes the one it replaces. */
  private async keep(hash: string, dataUrl: string): Promise<void> {
    try {
      const fetchedAt = Date.now();
      const name = `${hash}-${fetchedAt}.txt`;
      const dir = await this.avatarDir();
      await this.fs.mkdir(dir, { recursive: true });
      await this.fs.writeTextFile(await this.paths.join(dir, name), dataUrl);
      const kept = await this.loadKept();
      const replaced = kept.get(hash);
      kept.set(hash, { name, fetchedAt });
      if (replaced) await this.removeFile(replaced.name);
    } catch {
      // Not kept this time; the avatar is fetched again on the next start.
    }
  }

  /** The kept picture; null when another window removed or replaced the file meanwhile. */
  private async readPicture(file: KeptFile): Promise<string | null> {
    try {
      return await this.fs.readTextFile(await this.paths.join(await this.avatarDir(), file.name));
    } catch {
      return null;
    }
  }

  private loadKept(): Promise<Map<string, KeptFile>> {
    this.kept ??= this.readFolder();
    return this.kept;
  }

  /**
   * The newest file per hash, from the folder's names alone. Older copies,
   * avatars not fetched for weeks and those beyond `MAX_KEPT` are removed in
   * the background.
   */
  private async readFolder(): Promise<Map<string, KeptFile>> {
    let names: string[];
    try {
      names = (await this.fs.readDir(await this.avatarDir())).map((entry) => entry.name);
    } catch {
      return new Map();
    }
    const files = names
      .flatMap((name) => {
        const [, hash, fetchedAt] = FILE_NAME.exec(name) ?? [];
        return hash && fetchedAt ? [{ hash, name, fetchedAt: Number(fetchedAt) }] : [];
      })
      .sort((a, b) => b.fetchedAt - a.fetchedAt);
    const since = Date.now() - KEEP_FOR_MS;
    const kept = new Map<string, KeptFile>();
    const cleared: string[] = [];
    for (const file of files) {
      if (kept.has(file.hash) || file.fetchedAt < since || kept.size >= MAX_KEPT) {
        cleared.push(file.name);
      } else {
        kept.set(file.hash, { name: file.name, fetchedAt: file.fetchedAt });
      }
    }
    void Promise.all(cleared.map((name) => this.removeFile(name)));
    return kept;
  }

  private async removeFile(name: string): Promise<void> {
    try {
      await this.fs.remove(await this.paths.join(await this.avatarDir(), name));
    } catch {
      // Already gone, removed by another window say.
    }
  }

  private async avatarDir(): Promise<string> {
    const home = await this.paths.cognoHomeDir(isDevMode());
    return this.paths.join(home, ...AVATAR_DIR);
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

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
