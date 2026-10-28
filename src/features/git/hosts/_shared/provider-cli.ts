import { GitAccessOption, GitAccessPlatform, GitAccessStep, GitHostCli } from "./git-host";

/** The CLI among git's helpers for the host, if one is: signed in it serves git, signed out it says nothing. */
export function cliAmongHelpers(helpers: ReadonlyArray<string>): "gh" | "glab" | null {
  if (helpers.some((helper) => /\bgh auth git-credential\b/.test(helper))) return "gh";
  if (helpers.some((helper) => /\bglab auth git-credential\b/.test(helper))) return "glab";
  return null;
}

function hostFlag(cli: GitHostCli, host: string): string {
  return host === cli.home ? "" : ` --hostname ${host}`;
}

/** The CLI is already git's helper: only the sign-in is missing. */
export function signInOption(cli: GitHostCli, host: string): GitAccessOption {
  return {
    title: `Sign in with ${cli.name}`,
    detail: `${cli.name} is already git's credential helper for ${host}. Sign in once; git and Cogno use it from then on.`,
    steps: [signInStep(cli, host)],
  };
}

/** Install the CLI, sign in, make it git's helper. */
export function cliOption(
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
