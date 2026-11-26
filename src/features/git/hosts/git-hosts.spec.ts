import { describe, expect, it } from "vitest";
import { gitHost, gitHostFor, knownGitHost } from "./git-hosts";

describe("signing in in the browser", () => {
  it("is offered on the provider's own host, as a public client", () => {
    expect(knownGitHost("gitlab.com")?.signIn?.("gitlab.com")).toEqual({
      authorizeUrl: "https://gitlab.com/oauth/authorize",
      tokenUrl: "https://gitlab.com/oauth/token",
      scopes: ["read_repository", "write_repository"],
      clientId: expect.any(String),
      username: "oauth2",
    });
    expect(knownGitHost("codeberg.org")?.signIn?.("codeberg.org")).not.toBeNull();
  });

  it("carries the secret GitHub demands", () => {
    expect(knownGitHost("github.com")?.signIn?.("github.com")?.clientSecret).toEqual(
      expect.any(String),
    );
  });

  it("is not offered on an instance somebody runs themselves", () => {
    expect(gitHost("gitlab").signIn?.("gitlab.firma.de")).toBeNull();
    expect(gitHost("github").signIn?.("github.firma.de")).toBeNull();
  });

  it("is not offered where no app can be registered", () => {
    expect(gitHost("azure").signIn).toBeUndefined();
    expect(gitHost("other").signIn).toBeUndefined();
  });
});

describe("gitHostFor", () => {
  it("takes a host for its owner, then for what the person said, then for nobody's", () => {
    const remembered = { "git.firma.de": "gitlab", "gitlab.com": "github" } as const;

    expect(gitHostFor("gitlab.com", remembered).id).toBe("gitlab");
    expect(gitHostFor("git.firma.de", remembered).id).toBe("gitlab");
    expect(gitHostFor("example.org", remembered).id).toBe("other");
  });
});
