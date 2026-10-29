/**
 * What the access dialog knows about a git host: one definition per provider,
 * read by the one engine in `git-host-access.ts`. A definition holds only what
 * differs between providers; the ways in are built there from shared pieces.
 */
export type GitHostId = "github" | "gitlab" | "codeberg" | "azure" | "other";

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
  readonly provider: GitHostId;
  readonly platform: GitAccessPlatform;
  /** The remote is reached over ssh, so credentials are not the question. */
  readonly ssh: boolean;
  /** The credential helpers git has for this host, from `git config --get-urlmatch`. */
  readonly helpers: ReadonlyArray<string>;
};

/** A provider's CLI that signs in once and then serves git as its credential helper. */
export type GitHostCli = {
  readonly name: "gh" | "glab";
  /** The host the CLI assumes without `--hostname`. */
  readonly home: string;
  readonly installLink: string;
  /** Makes the CLI git's credential helper for `host`. */
  readonly setupHelper: (host: string) => string;
};

export type GitHostDefinition = {
  readonly id: GitHostId;
  readonly label: string;
  /** Whether this definition owns `host` without asking the person. */
  readonly owns: (host: string) => boolean;
  readonly cli?: GitHostCli;
  /** Whether the Git Credential Manager signs in to `host` in the browser. */
  readonly manager: (host: string) => boolean;
  /** What to create and enter as the password; one sentence, no trailing period. */
  readonly token: string;
  /** How the public key gets to the host, after `ssh-keygen`. */
  readonly sshKeyRegistration: (host: string) => GitAccessStep;
};

/** Shows the public key for pasting it where the host keeps keys. */
function pastePublicKeyStep(where: string): GitAccessStep {
  return {
    title: "Register the key",
    detail: `Paste the public key ${where}.`,
    commands: ["cat ~/.ssh/id_ed25519.pub"],
  };
}

/** github.com and GitHub Enterprise Server, through `gh`. */
const GITHUB_HOST: GitHostDefinition = {
  id: "github",
  label: "GitHub",
  owns: (host) => host === "github.com",
  cli: {
    name: "gh",
    home: "github.com",
    installLink: "https://github.com/cli/cli#installation",
    setupHelper: (host) => `gh auth setup-git${host === "github.com" ? "" : ` --hostname ${host}`}`,
  },
  manager: () => true,
  token:
    "GitHub does not accept your account password; create a personal access token with the repo scope",
  sshKeyRegistration: () => ({
    title: "Register the key",
    detail: "With gh signed in; or paste the public key in the account settings.",
    commands: ["gh ssh-key add ~/.ssh/id_ed25519.pub"],
  }),
};

/**
 * gitlab.com and self-managed GitLab, through `glab`. The credential manager
 * signs in to gitlab.com only: a self-managed instance would first need an
 * OAuth application registered on the server.
 */
const GITLAB_HOST: GitHostDefinition = {
  id: "gitlab",
  label: "GitLab",
  owns: (host) => host === "gitlab.com",
  cli: {
    name: "glab",
    home: "gitlab.com",
    installLink: "https://gitlab.com/gitlab-org/cli#installation",
    setupHelper: (host) =>
      `git config --global credential.https://${host}.helper '!glab auth git-credential'`,
  },
  manager: (host) => host === "gitlab.com",
  token: "Create a personal access token with the write_repository scope",
  sshKeyRegistration: () => ({
    title: "Register the key",
    detail: "With glab signed in; or paste the public key in the account settings.",
    commands: ["glab ssh-key add ~/.ssh/id_ed25519.pub"],
  }),
};

/** codeberg.org (Forgejo). No CLI serves git there; a token or an ssh key does. */
const CODEBERG_HOST: GitHostDefinition = {
  id: "codeberg",
  label: "Codeberg",
  owns: (host) => host === "codeberg.org",
  manager: () => true,
  token: "Create an access token under Settings → Applications, with write access to repositories",
  sshKeyRegistration: () => pastePublicKeyStep("under Settings → SSH / GPG Keys"),
};

/** Azure DevOps, through the credential manager (Microsoft sign-in) or a PAT. */
const AZURE_HOST: GitHostDefinition = {
  id: "azure",
  label: "Azure DevOps",
  owns: (host) =>
    host === "dev.azure.com" || host === "ssh.dev.azure.com" || host.endsWith(".visualstudio.com"),
  manager: () => true,
  token: "Create a personal access token with Code read and write",
  sshKeyRegistration: () => pastePublicKeyStep("in the user settings' SSH public keys"),
};

/** A host nobody here knows: the credential manager asks for name and password, or a token. */
const OTHER_HOST: GitHostDefinition = {
  id: "other",
  label: "Other",
  owns: () => false,
  manager: () => true,
  token: "Use the password or token the host expects",
  sshKeyRegistration: (host) => pastePublicKeyStep(`where ${host} keeps them`),
};

/** Every provider the access dialog knows, in the order it offers them; `other` last. */
export const GIT_HOSTS: ReadonlyArray<GitHostDefinition> = [
  GITHUB_HOST,
  GITLAB_HOST,
  CODEBERG_HOST,
  AZURE_HOST,
  OTHER_HOST,
];

export function gitHost(id: GitHostId): GitHostDefinition {
  return GIT_HOSTS.find((definition) => definition.id === id) ?? OTHER_HOST;
}

/** The provider that owns a host outright; null when the person has to say. */
export function knownGitHost(host: string): GitHostDefinition | null {
  return GIT_HOSTS.find((definition) => definition.owns(host)) ?? null;
}

export function isGitHostId(value: string): value is GitHostId {
  return GIT_HOSTS.some((definition) => definition.id === value);
}
