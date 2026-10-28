/**
 * What the access dialog knows about a git host: one definition per provider
 * in `hosts/<name>/`, read by the one engine in `git-host-access.ts`. A
 * definition holds only what differs between providers; the ways in are
 * built once, from the shared pieces in this folder.
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
