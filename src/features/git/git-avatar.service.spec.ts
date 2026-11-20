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
    exists: async (path: string) => files.has(path),
    readTextFile: async (path: string) => files.get(path) ?? "",
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
});
