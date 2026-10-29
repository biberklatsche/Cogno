import {
  GitAccessOption,
  GitAccessPlatform,
  GitAccessSituation,
  GitAccessStep,
  GitHostCli,
  gitHost,
} from "./git-hosts";

/** The helpers git knows how to store credentials with. */
const STORING_HELPERS = ["osxkeychain", "manager", "manager-core", "wincred", "libsecret"];

/**
 * The ways in for one situation, most convenient first, built from the
 * provider's definition and what git already has on this machine. This is
 * the only place that composes them; a provider only says what differs.
 */
export function accessOptions(situation: GitAccessSituation): ReadonlyArray<GitAccessOption> {
  const definition = gitHost(situation.provider);
  if (situation.ssh) {
    return [sshKeyOption(definition.sshKeyRegistration(situation.host), situation.host)];
  }
  const cli = definition.cli;
  if (cli && cliAmongHelpers(situation.helpers) === cli.name) {
    return [signInOption(cli, situation.host)];
  }
  const options: GitAccessOption[] = [];
  if (cli) options.push(cliOption(cli, definition.label, situation.host, situation.platform));
  if (definition.manager(situation.host)) {
    const label = definition.id === "other" ? "the host" : definition.label;
    options.push(managerOption(label, situation.platform));
  }
  options.push(tokenOption(definition.token, situation));
  return options;
}

/** What the situation comes down to, above the options. */
export function accessSummary(situation: GitAccessSituation): string {
  if (situation.ssh) {
    return `${situation.host} is reached over ssh. Git uses the keys and agent of your shell; Cogno adds nothing.`;
  }
  const cli = cliAmongHelpers(situation.helpers);
  if (cli) {
    return `${cli} serves git's credentials for ${situation.host} but is not signed in there.`;
  }
  if (storesCredentials(situation.helpers)) {
    return `Git stores credentials for ${situation.host} in your system's keychain, but has none yet.`;
  }
  return `No credential helper serves ${situation.host}. Git asks every time, and Cogno keeps nothing.`;
}

// The provider's CLI

/** The CLI among git's helpers for the host, if one is: signed in it serves git, signed out it says nothing. */
function cliAmongHelpers(helpers: ReadonlyArray<string>): "gh" | "glab" | null {
  if (helpers.some((helper) => /\bgh auth git-credential\b/.test(helper))) return "gh";
  if (helpers.some((helper) => /\bglab auth git-credential\b/.test(helper))) return "glab";
  return null;
}

function hostFlag(cli: GitHostCli, host: string): string {
  return host === cli.home ? "" : ` --hostname ${host}`;
}

/** The CLI is already git's helper: only the sign-in is missing. */
function signInOption(cli: GitHostCli, host: string): GitAccessOption {
  return {
    title: `Sign in with ${cli.name}`,
    detail: `${cli.name} is already git's credential helper for ${host}. Sign in once; git and Cogno use it from then on.`,
    steps: [signInStep(cli, host)],
  };
}

/** Install the CLI, sign in, make it git's helper. */
function cliOption(
  cli: GitHostCli,
  label: string,
  host: string,
  platform: GitAccessPlatform,
): GitAccessOption {
  return {
    title: `${label} CLI (${cli.name})`,
    detail: `One sign-in in the browser; ${cli.name} then serves git in the terminal and in Cogno alike.`,
    steps: [
      installStep(cli, platform),
      signInStep(cli, host),
      {
        title: "Make it git's credential helper",
        detail: `Git asks ${cli.name} for ${host} from now on.`,
        commands: [cli.setupHelper(host)],
      },
    ],
  };
}

function signInStep(cli: GitHostCli, host: string): GitAccessStep {
  return {
    title: "Sign in",
    detail: "Opens the browser; the token stays with the CLI.",
    commands: [`${cli.name} auth login${hostFlag(cli, host)}`],
  };
}

function installStep(cli: GitHostCli, platform: GitAccessPlatform): GitAccessStep {
  const title = `Install ${cli.name}`;
  const detail = "Skip this if it is already there.";
  if (platform === "macos") return { title, detail, commands: [`brew install ${cli.name}`] };
  return { title, detail, commands: [], link: cli.installLink };
}

// The Git Credential Manager

/** The Git Credential Manager: browser sign-in on the next push, token in the system's keychain. */
function managerOption(label: string, platform: GitAccessPlatform): GitAccessOption {
  return {
    title: "Git Credential Manager",
    detail: `Signs in to ${label} in the browser on the next push and keeps the token in your system's keychain.`,
    steps: [managerStep(platform)],
  };
}

function managerStep(platform: GitAccessPlatform): GitAccessStep {
  switch (platform) {
    case "macos":
      return {
        title: "Install Git Credential Manager",
        detail: "Registers itself as git's helper.",
        commands: ["brew install --cask git-credential-manager"],
      };
    case "windows":
      return {
        title: "Use the manager Git for Windows ships",
        detail: "Registers it as git's helper if the installer did not.",
        commands: ["git credential-manager configure"],
      };
    case "wsl":
      return {
        title: "Use the manager of Git for Windows from WSL",
        detail: "The Windows manager serves git inside the distro.",
        commands: [
          'git config --global credential.helper "/mnt/c/Program\\ Files/Git/mingw64/bin/git-credential-manager.exe"',
        ],
      };
    case "linux":
      return {
        title: "Install Git Credential Manager",
        detail: "Download the package for your distribution, then register it.",
        commands: ["git credential-manager configure"],
        link: "https://github.com/git-ecosystem/git-credential-manager/releases",
      };
  }
}

// A token

function storesCredentials(helpers: ReadonlyArray<string>): boolean {
  return helpers.some((helper) =>
    STORING_HELPERS.some((name) => helper === name || helper.endsWith(`git-credential-${name}`)),
  );
}

/** Type a token as the password; what git does with it depends on its helpers. */
function tokenOption(token: string, situation: GitAccessSituation): GitAccessOption {
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

// An ssh key

/** Create a key, register it with the host, check. */
function sshKeyOption(registration: GitAccessStep, host: string): GitAccessOption {
  return {
    title: "SSH key",
    detail: "Git uses the ssh of your shell. A key that works in the terminal works in Cogno.",
    steps: [
      {
        title: "Create a key",
        detail: "Skip this if you have one.",
        commands: ['ssh-keygen -t ed25519 -C "your@email"'],
      },
      registration,
      {
        title: "Check",
        detail: "Ssh greets you with your account name.",
        commands: [`ssh -T git@${host}`],
      },
    ],
  };
}
