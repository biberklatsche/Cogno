import { Injectable } from "@angular/core";
import { CommandRunner } from "@cogno/core/api/command-runner-port";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { Filesystem } from "@cogno/core/session/exec/filesystem";
import { ShellTypeContract } from "@cogno/shared/domain";
import { Observable, Subject } from "rxjs";
import { AssetCommandSpecRegistry } from "./spec-command/spec/asset-command-spec.registry";
import { CommandListSpecProvider } from "./spec-command/spec/providers/command-list.spec-provider";
import { FilesystemSpecProvider } from "./spec-command/spec/providers/filesystem.spec-provider";
import { GitBranchesSpecProvider } from "./spec-command/spec/providers/git-branches.spec-provider";
import { NpmScriptsSpecProvider } from "./spec-command/spec/providers/npm-scripts.spec-provider";
import { SpecCommandSuggestor } from "./spec-command/spec-command.suggestor";
import {
  AutocompleteProviderIssueContract,
  TerminalAutocompleteSuggestorContract,
} from "./suggestor.contracts";

const DEFAULT_PROVIDER_TIMEOUT_MS = 160;

/** A suggestor of a session's autocomplete failed while a session used it. */
export type AutocompleteSuggestorIssue = {
  readonly suggestorId: string;
  readonly message: string;
  readonly input: string;
  readonly terminalId?: string;
};

/**
 * The suggestors every session shares, built once instead of per session: the
 * command-spec suggestor with its bundled specs of 1000+ CLI tools. Failures
 * leave as events the workbench turns into notifications - the session side
 * stays off the bus.
 */
@Injectable({ providedIn: "root" })
export class SharedSuggestors {
  readonly specCommand: TerminalAutocompleteSuggestorContract;
  private readonly issues = new Subject<AutocompleteSuggestorIssue>();
  private readonly providerIssues = new Subject<AutocompleteProviderIssueContract>();

  /** A suggestor failed in a session. */
  readonly issues$: Observable<AutocompleteSuggestorIssue> = this.issues.asObservable();
  /** A spec provider (npm scripts, git branches, …) failed or timed out. */
  readonly providerIssues$: Observable<AutocompleteProviderIssueContract> =
    this.providerIssues.asObservable();

  constructor(filesystem: Filesystem, commandRunner: CommandRunner, configService: ConfigService) {
    this.specCommand = new SpecCommandSuggestor(
      new AssetCommandSpecRegistry(),
      [
        new NpmScriptsSpecProvider(filesystem),
        new FilesystemSpecProvider(filesystem),
        new GitBranchesSpecProvider(commandRunner),
        new CommandListSpecProvider(commandRunner),
      ],
      { reportAutocompleteProviderIssue: (issue) => this.providerIssues.next(issue) },
      () => providerTimeoutMs(configService),
    );
  }

  /** Warm up the shared suggestors for a shell that just authenticated. */
  preloadForShellIntegration(shellType: ShellTypeContract): void {
    void this.specCommand.warmUpForShellIntegration?.(shellType);
  }

  reportIssue(issue: AutocompleteSuggestorIssue): void {
    this.issues.next(issue);
  }
}

function providerTimeoutMs(configService: ConfigService): number {
  try {
    return configService.config.autocomplete?.provider?.timeout_ms ?? DEFAULT_PROVIDER_TIMEOUT_MS;
  } catch {
    return DEFAULT_PROVIDER_TIMEOUT_MS;
  }
}
