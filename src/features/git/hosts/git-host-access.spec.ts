import { describe, expect, it } from "vitest";
import { GitAccessSituation } from "./_shared/git-host";
import { accessOptions, accessSummary } from "./git-host-access";
import { isGitHostId, knownGitHost } from "./git-hosts";

const github: GitAccessSituation = {
  host: "github.com",
  provider: "github",
  platform: "macos",
  ssh: false,
  helpers: [],
};

describe("knownGitHost", () => {
  it("knows the public hosts and nothing else", () => {
    expect(knownGitHost("github.com")?.id).toBe("github");
    expect(knownGitHost("gitlab.com")?.id).toBe("gitlab");
    expect(knownGitHost("codeberg.org")?.id).toBe("codeberg");
    expect(knownGitHost("dev.azure.com")?.id).toBe("azure");
    expect(knownGitHost("ssh.dev.azure.com")?.id).toBe("azure");
    expect(knownGitHost("corp.visualstudio.com")?.id).toBe("azure");
    expect(knownGitHost("git.firma.de")).toBeNull();
    expect(isGitHostId("bitbucket")).toBe(false);
  });
});

describe("accessOptions", () => {
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
    expect(accessOptions(situation).map((option) => option.title)).toEqual(["Sign in with gh"]);
    expect(accessSummary(situation)).toContain("gh serves git's credentials");
  });

  it("names the host for an enterprise instance", () => {
    const commands = accessOptions({ ...github, host: "github.firma.de" })[0]?.steps.flatMap(
      (step) => step.commands,
    );
    expect(commands).toContain("gh auth login --hostname github.firma.de");
    expect(commands).toContain("gh auth setup-git --hostname github.firma.de");
  });

  it("leaves the credential manager out for a self-managed GitLab", () => {
    const situation: GitAccessSituation = {
      ...github,
      host: "gitlab.firma.de",
      provider: "gitlab",
    };
    expect(accessOptions(situation).map((option) => option.title)).toEqual([
      "GitLab CLI (glab)",
      "Enter a token",
    ]);
  });

  it("offers Codeberg a token and the manager, no CLI", () => {
    const situation: GitAccessSituation = { ...github, host: "codeberg.org", provider: "codeberg" };
    const options = accessOptions(situation);
    expect(options.map((option) => option.title)).toEqual([
      "Git Credential Manager",
      "Enter a token",
    ]);
    expect(options[1]?.detail).toContain("Settings → Applications");
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

  it("explains ssh keys for an ssh remote, registered the provider's way", () => {
    const options = accessOptions({ ...github, ssh: true });
    expect(options.map((option) => option.title)).toEqual(["SSH key"]);
    expect(options[0]?.steps.flatMap((step) => step.commands)).toContain(
      "gh ssh-key add ~/.ssh/id_ed25519.pub",
    );
    const codeberg = accessOptions({
      ...github,
      host: "codeberg.org",
      provider: "codeberg",
      ssh: true,
    });
    expect(codeberg[0]?.steps[1]?.detail).toContain("SSH / GPG Keys");
  });

  it("points WSL at the manager of Git for Windows", () => {
    const manager = accessOptions({ ...github, platform: "wsl" }).find(
      (option) => option.title === "Git Credential Manager",
    );
    expect(manager?.steps[0]?.commands[0]).toContain("git-credential-manager.exe");
  });
});
