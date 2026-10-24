import { GitAccessOption, GitAccessSituation } from "./git-host";

/** The helpers git knows how to store credentials with. */
const STORING_HELPERS = ["osxkeychain", "manager", "manager-core", "wincred", "libsecret"];

export function storesCredentials(helpers: ReadonlyArray<string>): boolean {
  return helpers.some((helper) =>
    STORING_HELPERS.some((name) => helper === name || helper.endsWith(`git-credential-${name}`)),
  );
}

/** Type a token as the password; what git does with it depends on its helpers. */
export function tokenOption(token: string, situation: GitAccessSituation): GitAccessOption {
  const kept = storesCredentials(situation.helpers)
    ? "Git stores it in your system's keychain."
    : situation.platform === "windows"
      ? "Git asks again next time."
      : "Git remembers it for an hour.";
  return {
    title: "Enter a token",
    detail: `${token}. Run the command in Cogno again and enter your username and the token as the password. ${kept}`,
    steps: [],
  };
}
