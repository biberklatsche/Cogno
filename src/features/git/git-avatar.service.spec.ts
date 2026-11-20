import { Fs, Paths } from "@cogno/platform";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GitAvatarService } from "./git-avatar.service";

/** SHA-256 of "lars@example.com": trimmed and lower-cased, as Gravatar hashes it. */
const HASH = "2c2ece48b58dfdbf0525443c84a4f5acd9a46857ca1d41b1f25b2a50e0f0ee20";
const EMAIL = "Lars@Example.com";
const FILE = "home/git/avatars.json";
const DAY = 24 * 60 * 60 * 1000;

describe("GitAvatarService", () => {
  let files: Map<string, string>;
  let fetchMock: ReturnType<typeof vi.fn>;

  const fs = {
    readTextFile: async (path: string) => {
      const text = files.get(path);
      if (text === undefined) throw new Error(`No such file: ${path}`);
      return text;
    },
    writeTextFile: async (path: string, data: string) => void files.set(path, data),
    mkdir: async () => undefined,
  } as unknown as Fs;
  const paths = {
    cognoHomeDir: async () => "home",
    join: async (...parts: string[]) => parts.join("/"),
    dirname: async (path: string) => path.slice(0, path.lastIndexOf("/")),
  } as unknown as Paths;

  const answer = (bytes: number[]) =>
    new Response(new Uint8Array(bytes), { headers: { "content-type": "image/png" } });

  /** Asks until the URL is known, as the template does on every change. */
  const urlOnce = async (service: GitAvatarService) => {
    service.url(EMAIL);
    await vi.waitFor(() => expect(service.url(EMAIL)).not.toBeNull());
    return service.url(EMAIL);
  };

  beforeEach(() => {
    files = new Map();
    fetchMock = vi.fn(async () => answer([1, 2, 3]));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("fetches the Gravatar of the hashed email and answers with it as a data URL", async () => {
    const service = new GitAvatarService(fs, paths);

    expect(service.url(EMAIL)).toBeNull();

    expect(await urlOnce(service)).toBe("data:image/png;base64,AQID");
    expect(fetchMock).toHaveBeenCalledWith(`https://www.gravatar.com/avatar/${HASH}?s=56&d=retro`);
  });

  it("keeps fetched avatars on disk under the hash, not the email", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const service = new GitAvatarService(fs, paths);
    await urlOnce(service);

    await vi.runAllTimersAsync();

    const stored = JSON.parse(files.get(FILE) ?? "{}");
    expect(Object.keys(stored)).toEqual([HASH]);
    expect(stored[HASH].dataUrl).toBe("data:image/png;base64,AQID");
  });

  it("shows a kept avatar without fetching", async () => {
    files.set(FILE, JSON.stringify({ [HASH]: { dataUrl: "data:kept", fetchedAt: Date.now() } }));
    const service = new GitAvatarService(fs, paths);

    expect(await urlOnce(service)).toBe("data:kept");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows an old kept avatar at once and swaps in the fresh one", async () => {
    files.set(
      FILE,
      JSON.stringify({ [HASH]: { dataUrl: "data:old", fetchedAt: Date.now() - 8 * DAY } }),
    );
    let release: () => void = () => undefined;
    fetchMock.mockImplementation(
      () => new Promise<Response>((resolve) => (release = () => resolve(answer([1, 2, 3])))),
    );
    const service = new GitAvatarService(fs, paths);

    expect(await urlOnce(service)).toBe("data:old");
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    release();
    await vi.waitFor(() => expect(service.url(EMAIL)).toBe("data:image/png;base64,AQID"));
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

  it("starts empty when the kept file cannot be read", async () => {
    files.set(FILE, "not json");
    const service = new GitAvatarService(fs, paths);

    expect(await urlOnce(service)).toBe("data:image/png;base64,AQID");
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

  it("drops a picture that cannot be shown from the file too, so it is fetched again", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    files.set(FILE, JSON.stringify({ [HASH]: { dataUrl: "data:broken", fetchedAt: Date.now() } }));
    const service = new GitAvatarService(fs, paths);
    expect(await urlOnce(service)).toBe("data:broken");

    service.markFailed(EMAIL);
    await vi.waitFor(() => vi.runAllTimersAsync());
    await vi.runAllTimersAsync();

    expect(JSON.parse(files.get(FILE) ?? "{}")).toEqual({});
    vi.useRealTimers();
    expect(await urlOnce(new GitAvatarService(fs, paths))).toBe("data:image/png;base64,AQID");
  });

  it("keeps nothing that is not a picture, such as a portal's page", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fetchMock.mockResolvedValue(
      new Response("<html></html>", { headers: { "content-type": "text/html" } }),
    );
    const service = new GitAvatarService(fs, paths);

    service.url(EMAIL);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await vi.runAllTimersAsync();

    expect(service.url(EMAIL)).toBeNull();
    expect(files.has(FILE)).toBe(false);
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

  it("writes what another window kept meanwhile, but not avatars unseen for weeks", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const service = new GitAvatarService(fs, paths);
    await urlOnce(service);
    // Another window wrote the file after this one read it.
    files.set(
      FILE,
      JSON.stringify({
        other: { dataUrl: "data:other", fetchedAt: Date.now() },
        unseen: { dataUrl: "data:unseen", fetchedAt: Date.now() - 40 * DAY },
      }),
    );

    await vi.runAllTimersAsync();

    expect(Object.keys(JSON.parse(files.get(FILE) ?? "{}")).sort()).toEqual([HASH, "other"]);
  });

  it("keeps at most 2000 avatars, the newest", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const now = Date.now();
    const stored = Object.fromEntries(
      Array.from({ length: 2000 }, (_, index) => [
        `h${index}`,
        { dataUrl: "data:x", fetchedAt: now - DAY - index },
      ]),
    );
    files.set(FILE, JSON.stringify(stored));
    const service = new GitAvatarService(fs, paths);
    await urlOnce(service);

    await vi.runAllTimersAsync();

    const written = Object.keys(JSON.parse(files.get(FILE) ?? "{}"));
    expect(written).toHaveLength(2000);
    expect(written).toContain(HASH);
    expect(written).not.toContain("h1999");
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
