import { describe, expect, it } from "vitest";
import { signInOn } from "./git-hosts";

const endpoints = {
  authorizeUrl: "https://gitlab.com/oauth/authorize",
  tokenUrl: "https://gitlab.com/oauth/token",
  scopes: ["write_repository"],
};

describe("signInOn", () => {
  it("signs in on the host the app is registered on, as a public client", () => {
    expect(signInOn("gitlab.com", { id: "client" }, endpoints)("gitlab.com")).toEqual({
      ...endpoints,
      clientId: "client",
      username: "oauth2",
    });
  });

  it("carries the secret a provider demands", () => {
    const provider = signInOn("github.com", { id: "client", secret: "public" }, endpoints);

    expect(provider("github.com")?.clientSecret).toBe("public");
  });

  it("offers nothing on an instance somebody runs themselves", () => {
    expect(signInOn("gitlab.com", { id: "client" }, endpoints)("gitlab.firma.de")).toBeNull();
  });

  it("offers nothing while the app is not registered", () => {
    expect(signInOn("gitlab.com", { id: "" }, endpoints)("gitlab.com")).toBeNull();
  });
});
