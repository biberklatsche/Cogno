import { describe, expect, it, vi } from "vitest";
import { GitAvatarService } from "./git-avatar.service";

describe("GitAvatarService", () => {
  const flush = () => vi.waitFor(() => expect(service().url("Lars@Example.com")).not.toBeNull());
  let current: GitAvatarService;
  const service = () => current;

  it("answers with the Gravatar URL of the hashed email once it is computed", async () => {
    current = new GitAvatarService();

    expect(current.url("Lars@Example.com")).toBeNull();
    await flush();

    // SHA-256 of "lars@example.com": trimmed and lower-cased, as Gravatar hashes it.
    expect(current.url("Lars@Example.com")).toBe(
      "https://www.gravatar.com/avatar/2c2ece48b58dfdbf0525443c84a4f5acd9a46857ca1d41b1f25b2a50e0f0ee20?s=56&d=retro",
    );
  });

  it("has nothing for an empty email", () => {
    current = new GitAvatarService();
    expect(current.url("")).toBeNull();
    expect(current.url("   ")).toBeNull();
  });

  it("drops an avatar that failed to load", async () => {
    current = new GitAvatarService();
    current.url("Lars@Example.com");
    await flush();

    current.markFailed("Lars@Example.com");

    expect(current.url("Lars@Example.com")).toBeNull();
  });
});
