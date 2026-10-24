/**
 * How to get git access to a remote host, as the access dialog explains it:
 * which host a remote url names, which provider is behind it, and the ways
 * the person can sign in - every one of them through git's own credential
 * helpers or the provider's CLI, never through anything Cogno stores.
 */
export type GitHostProvider = "github" | "gitlab" | "bitbucket" | "azure" | "other";

/** Where the commands run; WSL has its own recipe for the Windows helper. */
export type GitAccessPlatform = "macos" | "linux" | "windows" | "wsl";

export type GitAccessStep = {
  readonly title: string;
  readonly detail: string;
  /** Shell commands the person runs in the terminal, in order. */
  readonly commands: ReadonlyArray<string>;
  /** A page to open instead of a command (an installer, a token page). */
  readonly link?: string;
};

export type GitAccessOption = {
  readonly title: string;
  readonly detail: string;
  readonly steps: ReadonlyArray<GitAccessStep>;
};

export type GitAccessSituation = {
  readonly host: string;
  readonly provider: GitHostProvider;
  readonly platform: GitAccessPlatform;
  /** The remote is reached over ssh, so credentials are not the question. */
  readonly ssh: boolean;
  /** The credential helpers git has for this host, from `git config --get-urlmatch`. */
  readonly helpers: ReadonlyArray<string>;
};

export const PROVIDER_LABELS: Readonly<Record<GitHostProvider, string>> = {
  github: "GitHub",
  gitlab: "GitLab",
  bitbucket: "Bitbucket",
  azure: "Azure DevOps",
  other: "Other",
};

/** The host a remote url names: `https://`, `ssh://`, or scp-like `git@host:path`. */
export function hostOf(url: string): string | null {
  const trimmed = url.trim();
  // A scheme without a host (`file:///path`) names no host at all.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/]+@)?([^/:]+)/i.exec(trimmed);
    return withScheme?.[1]?.toLowerCase() ?? null;
  }
  // Two characters at least: `C:\path` is a drive, not a host.
  const scpLike = /^(?:[^@/]+@)?([^:/\\]{2,}):/.exec(trimmed);
  return scpLike?.[1]?.toLowerCase() ?? null;
}

/** Whether a remote url goes over ssh; everything else asks for credentials. */
export function isSshUrl(url: string): boolean {
  const trimmed = url.trim();
  if (/^(ssh|git):\/\//i.test(trimmed)) return true;
  return !/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) && /^(?:[^@/]+@)?[^:/\\]{2,}:/.test(trimmed);
}

/**
 * The https url git keys credentials for this remote by: the remote's own
 * origin with its port, or the host alone for an ssh remote - the provider
 * CLIs store credentials under the https host of the same server.
 */
export function credentialUrlOf(url: string): string | null {
  const host = hostOf(url);
  if (!host) return null;
  const origin = /^https?:\/\/(?:[^@/]+@)?([^/]+)/i.exec(url.trim());
  return `https://${origin ? origin[1]?.toLowerCase() : host}`;
}

/** The provider behind a well-known host; null for a host nobody can tell. */
export function knownProvider(host: string): GitHostProvider | null {
  if (host === "github.com") return "github";
  if (host === "gitlab.com") return "gitlab";
  if (host === "bitbucket.org") return "bitbucket";
  if (host === "dev.azure.com" || host === "ssh.dev.azure.com") return "azure";
  if (host.endsWith(".visualstudio.com")) return "azure";
  return null;
}

/** The helpers git knows how to store credentials with. */
const STORING_HELPERS = ["osxkeychain", "manager", "manager-core", "wincred", "libsecret"];

/** A helper that is a provider CLI: signed in, it serves git; signed out, it says nothing. */
function cliHelper(helpers: ReadonlyArray<string>): "gh" | "glab" | null {
  if (helpers.some((helper) => /\bgh auth git-credential\b/.test(helper))) return "gh";
  if (helpers.some((helper) => /\bglab auth git-credential\b/.test(helper))) return "glab";
  return null;
}

function storesCredentials(helpers: ReadonlyArray<string>): boolean {
  return helpers.some((helper) =>
    STORING_HELPERS.some((name) => helper === name || helper.endsWith(`git-credential-${name}`)),
  );
}

/** The ways in, most convenient first, for what git already has on this machine. */
export function accessOptions(situation: GitAccessSituation): ReadonlyArray<GitAccessOption> {
  if (situation.ssh) return [sshKeyOption(situation)];
  const cli = cliHelper(situation.helpers);
  if (cli === "gh") return [signInOption("gh", situation)];
  if (cli === "glab") return [signInOption("glab", situation)];

  const options: GitAccessOption[] = [];
  if (situation.provider === "github") options.push(cliOption("gh", situation));
  if (situation.provider === "gitlab") options.push(cliOption("glab", situation));
  if (situation.provider !== "gitlab" || situation.host === "gitlab.com") {
    options.push(managerOption(situation));
  }
  options.push(tokenOption(situation));
  return options;
}

/** What the situation comes down to, above the options. */
export function accessSummary(situation: GitAccessSituation): string {
  if (situation.ssh) {
    return `${situation.host} is reached over ssh. Git uses the keys and agent of your shell; Cogno adds nothing.`;
  }
  const cli = cliHelper(situation.helpers);
  if (cli) {
    return `${cli} serves git's credentials for ${situation.host} but is not signed in there.`;
  }
  if (storesCredentials(situation.helpers)) {
    return `Git stores credentials for ${situation.host} in your system's keychain, but has none yet.`;
  }
  return `No credential helper serves ${situation.host}. Git asks every time, and Cogno keeps nothing.`;
}

function hostFlag(cli: "gh" | "glab", situation: GitAccessSituation): string {
  const home = cli === "gh" ? "github.com" : "gitlab.com";
  return situation.host === home ? "" : ` --hostname ${situation.host}`;
}

function signInOption(cli: "gh" | "glab", situation: GitAccessSituation): GitAccessOption {
  return {
    title: `Sign in with ${cli}`,
    detail: `${cli} is already git's credential helper for ${situation.host}. Sign in once; git and Cogno use it from then on.`,
    steps: [
      {
        title: "Sign in",
        detail: "Opens the browser; the token stays with the CLI.",
        commands: [`${cli} auth login${hostFlag(cli, situation)}`],
      },
    ],
  };
}

function cliOption(cli: "gh" | "glab", situation: GitAccessSituation): GitAccessOption {
  const setup =
    cli === "gh"
      ? `gh auth setup-git${hostFlag("gh", situation)}`
      : `git config --global credential.https://${situation.host}.helper '!glab auth git-credential'`;
  return {
    title: `${PROVIDER_LABELS[situation.provider]} CLI (${cli})`,
    detail: `One sign-in in the browser; ${cli} then serves git in the terminal and in Cogno alike.`,
    steps: [
      installStep(cli, situation.platform),
      {
        title: "Sign in",
        detail: "Opens the browser; the token stays with the CLI.",
        commands: [`${cli} auth login${hostFlag(cli, situation)}`],
      },
      {
        title: "Make it git's credential helper",
        detail: `Git asks ${cli} for ${situation.host} from now on.`,
        commands: [setup],
      },
    ],
  };
}

function installStep(cli: "gh" | "glab", platform: GitAccessPlatform): GitAccessStep {
  const title = `Install ${cli}`;
  const detail = "Skip this if it is already there.";
  if (platform === "macos") return { title, detail, commands: [`brew install ${cli}`] };
  return {
    title,
    detail,
    commands: [],
    link:
      cli === "gh"
        ? "https://github.com/cli/cli#installation"
        : "https://gitlab.com/gitlab-org/cli#installation",
  };
}

function managerOption(situation: GitAccessSituation): GitAccessOption {
  const steps: GitAccessStep[] = [];
  switch (situation.platform) {
    case "macos":
      steps.push({
        title: "Install Git Credential Manager",
        detail: "Registers itself as git's helper.",
        commands: ["brew install --cask git-credential-manager"],
      });
      break;
    case "windows":
      steps.push({
        title: "Use the manager Git for Windows ships",
        detail: "Registers it as git's helper if the installer did not.",
        commands: ["git credential-manager configure"],
      });
      break;
    case "wsl":
      steps.push({
        title: "Use the manager of Git for Windows from WSL",
        detail: "The Windows manager serves git inside the distro.",
        commands: [
          'git config --global credential.helper "/mnt/c/Program\\ Files/Git/mingw64/bin/git-credential-manager.exe"',
        ],
      });
      break;
    case "linux":
      steps.push({
        title: "Install Git Credential Manager",
        detail: "Download the package for your distribution, then register it.",
        commands: ["git credential-manager configure"],
        link: "https://github.com/git-ecosystem/git-credential-manager/releases",
      });
      break;
  }
  return {
    title: "Git Credential Manager",
    detail: `Signs in to ${PROVIDER_LABELS[situation.provider] === "Other" ? "the host" : PROVIDER_LABELS[situation.provider]} in the browser on the next push and keeps the token in your system's keychain.`,
    steps,
  };
}

function tokenOption(situation: GitAccessSituation): GitAccessOption {
  const kept = storesCredentials(situation.helpers)
    ? "Git stores it in your system's keychain."
    : situation.platform === "windows"
      ? "Git asks again next time."
      : "Git remembers it for an hour.";
  const what: Record<GitHostProvider, string> = {
    github:
      "GitHub does not accept your account password; create a personal access token with the repo scope",
    gitlab: "Create a personal access token with the write_repository scope",
    bitbucket: "Create an API token",
    azure: "Create a personal access token with Code read and write",
    other: "Use the password or token the host expects",
  };
  return {
    title: "Enter a token",
    detail: `${what[situation.provider]}. Run the command in Cogno again and enter your username and the token as the password. ${kept}`,
    steps: [],
  };
}

function sshKeyOption(situation: GitAccessSituation): GitAccessOption {
  const upload: Record<GitHostProvider, GitAccessStep> = {
    github: {
      title: "Register the key",
      detail: "With gh signed in; or paste the public key in the account settings.",
      commands: ["gh ssh-key add ~/.ssh/id_ed25519.pub"],
    },
    gitlab: {
      title: "Register the key",
      detail: "With glab signed in; or paste the public key in the account settings.",
      commands: ["glab ssh-key add ~/.ssh/id_ed25519.pub"],
    },
    bitbucket: {
      title: "Register the key",
      detail: "Paste the public key in the account's SSH keys.",
      commands: ["cat ~/.ssh/id_ed25519.pub"],
    },
    azure: {
      title: "Register the key",
      detail: "Paste the public key in the user settings' SSH public keys.",
      commands: ["cat ~/.ssh/id_ed25519.pub"],
    },
    other: {
      title: "Register the key",
      detail: `Paste the public key where ${situation.host} keeps them.`,
      commands: ["cat ~/.ssh/id_ed25519.pub"],
    },
  };
  return {
    title: "SSH key",
    detail: "Git uses the ssh of your shell. A key that works in the terminal works in Cogno.",
    steps: [
      {
        title: "Create a key",
        detail: "Skip this if you have one.",
        commands: ['ssh-keygen -t ed25519 -C "your@email"'],
      },
      upload[situation.provider],
      {
        title: "Check",
        detail: `Ssh greets you with your account name.`,
        commands: [`ssh -T git@${situation.host}`],
      },
    ],
  };
}
