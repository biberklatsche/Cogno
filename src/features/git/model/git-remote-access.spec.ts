import { describe, expect, it } from "vitest";
import {
  accessOptions,
  accessSummary,
  credentialUrlOf,
  GitAccessSituation,
  hostOf,
  isSshUrl,
  knownProvider,
} from "./git-remote-access";

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

describe("credentialUrlOf", () => {
  it("keeps the port of an https remote and maps an ssh remote to its https host", () => {
    expect(credentialUrlOf("https://lars@gitlab.example.org:8443/group/repo")).toBe(
      "https://gitlab.example.org:8443",
    );
    expect(credentialUrlOf("git@github.com:user/repo.git")).toBe("https://github.com");
    expect(credentialUrlOf("file:///srv/git/repo.git")).toBeNull();
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

describe("knownProvider", () => {
  it("knows the public hosts and nothing else", () => {
    expect(knownProvider("github.com")).toBe("github");
    expect(knownProvider("gitlab.com")).toBe("gitlab");
    expect(knownProvider("bitbucket.org")).toBe("bitbucket");
    expect(knownProvider("dev.azure.com")).toBe("azure");
    expect(knownProvider("ssh.dev.azure.com")).toBe("azure");
    expect(knownProvider("corp.visualstudio.com")).toBe("azure");
    expect(knownProvider("git.firma.de")).toBeNull();
  });
});

describe("accessOptions", () => {
  const github: GitAccessSituation = {
    host: "github.com",
    provider: "github",
    platform: "macos",
    ssh: false,
    helpers: [],
  };

  it("offers the CLI, the credential manager and a token when nothing is set up", () => {
    const options = accessOptions(github);
    expect(options.map((option) => option.title)).toEqual([
      "GitHub CLI (gh)",
      "Git Credential Manager",
      "Enter a token",
    ]);
    expect(options[0]?.steps.flatMap((step) => step.commands)).toEqual([
      "brew install gh",
      "gh auth login",
      "gh auth setup-git",
    ]);
    expect(accessSummary(github)).toContain("No credential helper");
  });

  it("only asks for a sign-in when gh already serves git for the host", () => {
    const situation = { ...github, helpers: ["!gh auth git-credential"] };
    const options = accessOptions(situation);
    expect(options.map((option) => option.title)).toEqual(["Sign in with gh"]);
    expect(accessSummary(situation)).toContain("gh serves git's credentials");
  });

  it("names the host for an enterprise instance", () => {
    const situation = { ...github, host: "github.firma.de" };
    const commands = accessOptions(situation)[0]?.steps.flatMap((step) => step.commands);
    expect(commands).toContain("gh auth login --hostname github.firma.de");
    expect(commands).toContain("gh auth setup-git --hostname github.firma.de");
  });

  it("leaves the credential manager out for a self-managed GitLab", () => {
    const situation: GitAccessSituation = {
      ...github,
      host: "gitlab.firma.de",
      provider: "gitlab",
    };
    const titles = accessOptions(situation).map((option) => option.title);
    expect(titles).toEqual(["GitLab CLI (glab)", "Enter a token"]);
  });

  it("says a typed token is kept when git has a storing helper", () => {
    const situation = { ...github, helpers: ["osxkeychain"] };
    const token = accessOptions(situation).find((option) => option.title === "Enter a token");
    expect(token?.detail).toContain("keychain");
    expect(accessSummary(situation)).toContain("keychain");
  });

  it("says a typed token lasts an hour without one", () => {
    const token = accessOptions(github).find((option) => option.title === "Enter a token");
    expect(token?.detail).toContain("for an hour");
  });

  it("explains ssh keys for an ssh remote", () => {
    const options = accessOptions({ ...github, ssh: true });
    expect(options.map((option) => option.title)).toEqual(["SSH key"]);
    expect(options[0]?.steps.flatMap((step) => step.commands)).toContain(
      "gh ssh-key add ~/.ssh/id_ed25519.pub",
    );
  });

  it("points WSL at the manager of Git for Windows", () => {
    const options = accessOptions({ ...github, platform: "wsl" });
    const manager = options.find((option) => option.title === "Git Credential Manager");
    expect(manager?.steps[0]?.commands[0]).toContain("git-credential-manager.exe");
  });
});
