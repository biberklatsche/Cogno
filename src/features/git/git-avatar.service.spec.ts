import { Fs, Paths } from "@cogno/platform";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GitAvatarService } from "./git-avatar.service";

/** SHA-256 of "lars@example.com": trimmed and lower-cased, as Gravatar hashes it. */
const HASH = "2c2ece48b58dfdbf0525443c84a4f5acd9a46857ca1d41b1f25b2a50e0f0ee20";
const OTHER = "f".repeat(64);
const EMAIL = "Lars@Example.com";
const DIR = "home/cache/avatars";
const DAY = 24 * 60 * 60 * 1000;

describe("GitAvatarService", () => {
  let files: Map<string, string>;
  let reads: string[];
  let fetchMock: ReturnType<typeof vi.fn>;

  const fs = {
    readTextFile: async (path: string) => {
      reads.push(path);
      const text = files.get(path);
      if (text === undefined) throw new Error(`No such file: ${path}`);
      return text;
    },
    writeTextFile: async (path: string, data: string) => void files.set(path, data),
    mkdir: async () => undefined,
    readDir: async (path: string) =>
      [...files.keys()]
        .filter((file) => file.startsWith(`${path}/`))
        .map((file) => ({ name: file.slice(path.length + 1) })),
    remove: async (path: string) => void files.delete(path),
  } as unknown as Fs;
  const paths = {
    cognoHomeDir: async () => "home",
    join: async (...parts: string[]) => parts.join("/"),
  } as unknown as Paths;

  const answer = (bytes: number[]) =>
    new Response(new Uint8Array(bytes), { headers: { "content-type": "image/png" } });
  const keptFile = (hash: string, fetchedAt: number) => `${DIR}/${hash}-${fetchedAt}.txt`;
  const filesOf = (hash: string) => [...files.keys()].filter((file) => file.includes(hash));

  /** Asks until the URL is known, as the template does on every change. */
  const urlOnce = async (service: GitAvatarService) => {
    service.url(EMAIL);
    await vi.waitFor(() => expect(service.url(EMAIL)).not.toBeNull());
    return service.url(EMAIL);
  };

  beforeEach(() => {
    files = new Map();
    reads = [];
    fetchMock = vi.fn(async () => answer([1, 2, 3]));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches the Gravatar of the hashed email and answers with it as a data URL", async () => {
    const service = new GitAvatarService(fs, paths);

    expect(service.url(EMAIL)).toBeNull();

    expect(await urlOnce(service)).toBe("data:image/png;base64,AQID");
    expect(fetchMock).toHaveBeenCalledWith(`https://www.gravatar.com/avatar/${HASH}?s=56&d=retro`);
  });

  it("keeps a fetched avatar in a file of its own, named by the hash, not the email", async () => {
    const service = new GitAvatarService(fs, paths);
    await urlOnce(service);

    await vi.waitFor(() => expect(filesOf(HASH)).toHaveLength(1));
    const [file] = filesOf(HASH);
    expect(file).toMatch(new RegExp(`^${DIR}/${HASH}-\\d+\\.txt$`));
    expect(files.get(file ?? "")).toBe("data:image/png;base64,AQID");
  });

  it("shows a kept avatar without fetching", async () => {
    files.set(keptFile(HASH, Date.now()), "data:kept");
    const service = new GitAvatarService(fs, paths);

    expect(await urlOnce(service)).toBe("data:kept");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads only the pictures of the authors it shows", async () => {
    const shown = keptFile(HASH, Date.now());
    files.set(shown, "data:kept");
    files.set(keptFile(OTHER, Date.now()), "data:other");
    const service = new GitAvatarService(fs, paths);

    await urlOnce(service);

    expect(reads).toEqual([shown]);
  });

  it("shows an old kept avatar at once, swaps in the fresh one and replaces its file", async () => {
    const old = keptFile(HASH, Date.now() - 8 * DAY);
    files.set(old, "data:old");
    let release: () => void = () => undefined;
    fetchMock.mockImplementation(
      () => new Promise<Response>((resolve) => (release = () => resolve(answer([1, 2, 3])))),
    );
    const service = new GitAvatarService(fs, paths);

    expect(await urlOnce(service)).toBe("data:old");
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    release();
    await vi.waitFor(() => expect(service.url(EMAIL)).toBe("data:image/png;base64,AQID"));

    await vi.waitFor(() => expect(files.has(old)).toBe(false));
    expect(filesOf(HASH)).toHaveLength(1);
  });

  it("fetches anew when the kept file went away meanwhile", async () => {
    const service = new GitAvatarService(fs, paths);
    files.set(keptFile(HASH, Date.now()), "data:kept");
    // Another window removes it between the folder's listing and the read.
    const readDir = fs.readDir;
    vi.spyOn(fs, "readDir").mockImplementationOnce(async (path) => {
      const entries = await readDir(path);
      files.clear();
      return entries;
    });

    expect(await urlOnce(service)).toBe("data:image/png;base64,AQID");
  });

  it("has none when Gravatar cannot be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    const service = new GitAvatarService(fs, paths);

    service.url(EMAIL);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(service.url(EMAIL)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("has nothing for an empty email", () => {
    const service = new GitAvatarService(fs, paths);
    expect(service.url("")).toBeNull();
    expect(service.url("   ")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("drops an avatar that failed to load", async () => {
    const service = new GitAvatarService(fs, paths);
    await urlOnce(service);

    service.markFailed(EMAIL);

    expect(service.url(EMAIL)).toBeNull();
  });

  it("removes a picture that cannot be shown from disk too, so it is fetched again", async () => {
    files.set(keptFile(HASH, Date.now()), "data:broken");
    const service = new GitAvatarService(fs, paths);
    expect(await urlOnce(service)).toBe("data:broken");

    service.markFailed(EMAIL);

    await vi.waitFor(() => expect(filesOf(HASH)).toEqual([]));
    expect(await urlOnce(new GitAvatarService(fs, paths))).toBe("data:image/png;base64,AQID");
  });

  it("keeps nothing that is not a picture, such as a portal's page", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html></html>", { headers: { "content-type": "text/html" } }),
    );
    const service = new GitAvatarService(fs, paths);

    service.url(EMAIL);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(service.url(EMAIL)).toBeNull();
    expect(files.size).toBe(0);
  });

  it("leaves the parameters of the content type out of the data URL", async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "Image/PNG; charset=binary" },
      }),
    );
    const service = new GitAvatarService(fs, paths);

    expect(await urlOnce(service)).toBe("data:image/png;base64,AQID");
  });

  it("fetches once for emails that differ only in case and spaces", async () => {
    let release: () => void = () => undefined;
    fetchMock.mockImplementation(
      () => new Promise<Response>((resolve) => (release = () => resolve(answer([1, 2, 3])))),
    );
    const service = new GitAvatarService(fs, paths);

    service.url(EMAIL);
    service.url(" lars@example.com ");
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    release();

    await vi.waitFor(() => expect(service.url(" lars@example.com ")).not.toBeNull());
    expect(service.url(EMAIL)).toBe(service.url(" lars@example.com "));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("clears out older copies and avatars unseen for weeks by their names alone", async () => {
    const now = Date.now();
    files.set(keptFile(HASH, now), "data:new");
    files.set(keptFile(HASH, now - DAY), "data:older copy");
    files.set(keptFile(OTHER, now - 40 * DAY), "data:unseen");
    const service = new GitAvatarService(fs, paths);

    expect(await urlOnce(service)).toBe("data:new");

    await vi.waitFor(() => expect([...files.keys()]).toEqual([keptFile(HASH, now)]));
    expect(reads).toEqual([keptFile(HASH, now)]);
  });

  it("keeps at most 2000 avatars, the newest", async () => {
    const now = Date.now();
    for (let index = 0; index < 2001; index++) {
      files.set(keptFile(index.toString(16).padStart(64, "0"), now - DAY - index), "data:x");
    }
    const service = new GitAvatarService(fs, paths);

    service.url(EMAIL);

    const oldest = keptFile((2000).toString(16).padStart(64, "0"), now - DAY - 2000);
    await vi.waitFor(() => expect(files.has(oldest)).toBe(false));
    expect(files.size).toBeGreaterThanOrEqual(2000);
  });

  it("gives up on an email it cannot hash instead of asking forever", async () => {
    const digest = vi.spyOn(crypto.subtle, "digest").mockRejectedValueOnce(new Error("no crypto"));
    const service = new GitAvatarService(fs, paths);

    service.url(EMAIL);
    await vi.waitFor(() => expect(digest).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    service.url(EMAIL);

    expect(service.url(EMAIL)).toBeNull();
    expect(digest).toHaveBeenCalledTimes(1);
    digest.mockRestore();
  });
});
