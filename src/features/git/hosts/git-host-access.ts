import { managerOption } from "./_shared/credential-manager";
import { GitAccessOption, GitAccessSituation } from "./_shared/git-host";
import { cliAmongHelpers, cliOption, signInOption } from "./_shared/provider-cli";
import { sshKeyOption } from "./_shared/ssh-key";
import { storesCredentials, tokenOption } from "./_shared/token";
import { gitHost } from "./git-hosts";

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
