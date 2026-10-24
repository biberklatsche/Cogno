import { describe, expect, it } from "vitest";
import { credentialUrlOf, hostOf, isSshUrl } from "./git-remote-url";

describe("hostOf", () => {
  it.each([
    ["https://github.com/user/repo.git", "github.com"],
    ["https://lars@gitlab.example.org:8443/group/repo", "gitlab.example.org"],
    ["ssh://git@github.com:22/user/repo.git", "github.com"],
    ["git@github.com:user/repo.git", "github.com"],
    ["git@Git.Firma.DE:team/repo", "git.firma.de"],
    ["/srv/git/repo.git", null],
    ["file:///srv/git/repo.git", null],
    ["C:\\repos\\thing", null],
  ])("reads %s as %s", (url, host) => {
    expect(hostOf(url)).toBe(host);
  });
});

describe("isSshUrl", () => {
  it.each([
    ["git@github.com:user/repo.git", true],
    ["ssh://git@github.com/user/repo.git", true],
    ["https://github.com/user/repo.git", false],
    ["/srv/git/repo.git", false],
  ])("%s -> %s", (url, ssh) => {
    expect(isSshUrl(url)).toBe(ssh);
  });
});

describe("credentialUrlOf", () => {
  it("keeps the port of an https remote and maps an ssh remote to its https host", () => {
    expect(credentialUrlOf("https://lars@gitlab.example.org:8443/group/repo")).toBe(
      "https://gitlab.example.org:8443",
    );
    expect(credentialUrlOf("git@github.com:user/repo.git")).toBe("https://github.com");
    expect(credentialUrlOf("file:///srv/git/repo.git")).toBeNull();
  });
});
