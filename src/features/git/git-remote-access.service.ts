import { Injectable } from "@angular/core";
import { TerminalNavigator } from "@cogno/core/api/terminal-navigator-port";
import { ClipboardAccess, Opener } from "@cogno/platform";
import { isWslShellContext } from "@cogno/shared/domain";
import { DialogService } from "@cogno/shared/ui";
import { GitRepositoryService } from "./git-repository.service";
import { GitViewState } from "./git-view-state.service";
import { GitAccessPlatform, GitAccessSituation } from "./hosts/_shared/git-host";
import { knownGitHost } from "./hosts/git-hosts";
import { credentialUrlOf, hostOf, isSshUrl } from "./model/git-remote-url";
import { GitAccessDialogComponent, GitAccessDialogData } from "./ui/git-access-dialog.component";

/** `git config` reads a few lines of config; no network. */
const CONFIG_TIMEOUT_MS = 10_000;

/**
 * Opens the access dialog for a remote: what git has for its host and the
 * ways to sign in. Commands go on the terminal's input line for the person to
 * run; the provider chosen for an unknown host is remembered with the view.
 */
@Injectable({ providedIn: "root" })
export class GitRemoteAccessService {
  constructor(
    private readonly repository: GitRepositoryService,
    private readonly view: GitViewState,
    private readonly dialogs: DialogService,
    private readonly clipboard: ClipboardAccess,
    private readonly opener: Opener,
    private readonly navigator: TerminalNavigator,
  ) {}

  /** The dialog for the host `url` names; nothing for a local path. */
  async open(url: string): Promise<void> {
    const host = hostOf(url);
    const session = this.repository.currentSession();
    if (!host || !session) return;
    const known = knownGitHost(host);
    const remembered = this.view.hosts()[host];
    const situation: GitAccessSituation = {
      host,
      provider: known?.id ?? remembered ?? "other",
      platform: platformOf(session.shellContext),
      ssh: isSshUrl(url),
      helpers: await this.helpersFor(credentialUrlOf(url) ?? `https://${host}`),
    };
    const data: GitAccessDialogData = {
      situation,
      askProvider: known === null,
      onProvider: (provider) => this.view.hosts.update((hosts) => ({ ...hosts, [host]: provider })),
      onInsert: (command) => this.insert(command),
      onCopy: (command) => void this.clipboard.writeText(command),
      onOpenLink: (link) => void this.opener.openUrl(link),
    };
    this.dialogs.open<GitAccessDialogData, void>(GitAccessDialogComponent, {
      title: `Access to ${host}`,
      data,
      width: "40rem",
      maxWidth: "calc(100vw - 2rem)",
    });
  }

  /**
   * The credential helpers git would ask for the remote, from its config - the
   * values, never a message. `credentialUrl` keeps the remote's port, since a
   * helper may be scoped to it.
   */
  private async helpersFor(credentialUrl: string): Promise<ReadonlyArray<string>> {
    const result = await this.repository.runInCwd(
      ["config", "--get-urlmatch", "credential.helper", credentialUrl],
      CONFIG_TIMEOUT_MS,
    );
    if (!result || result.exitCode !== 0) return [];
    return result.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  /**
   * Put the command on the bound terminal's input line and bring the terminal
   * into view; the reason when the terminal refused.
   */
  private async insert(command: string): Promise<string | null> {
    const session = this.repository.currentSession();
    if (!session) return "No terminal is bound - copy the command and run it yourself.";
    const result = await session.insertInput(command, session.contextRevision);
    if (result.status === "rejected") {
      return result.reason === "busy"
        ? "The terminal is running a command. Let it finish, then try again."
        : "The terminal did not take the command - copy it and run it yourself.";
    }
    await this.navigator.navigateToTerminal(session.identity.terminalId);
    return null;
  }
}

function platformOf(shellContext: Parameters<typeof isWslShellContext>[0]): GitAccessPlatform {
  if (isWslShellContext(shellContext)) return "wsl";
  return shellContext.backendOs;
}
