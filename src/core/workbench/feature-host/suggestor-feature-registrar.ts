import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import {
  AutocompleteSuggestorIssue,
  SuggestorRegistry,
} from "@cogno/core/session/autocomplete/suggestor-registry";
import { ActionName } from "@cogno/core/workbench/bus/action.models";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import {
  AutocompleteProviderIssueContract,
  AutocompleteProviderIssueReporterContract,
  FeatureDefinition,
  TerminalAutocompleteSuggestorContract,
} from "@cogno/shared/contributions";
import { CommandRunner, Filesystem } from "@cogno/shared/ports";
import { FeatureContributionRegistrar } from "./feature-reconciler";

const AUTOCOMPLETE_PROVIDER_NOTIFICATION_THROTTLE_MS = 10_000;
const DEFAULT_AUTOCOMPLETE_PROVIDER_TIMEOUT_MS = 160;

/**
 * The autocomplete-suggestor contribution as the reconciler sees it: activating
 * a feature builds its suggestors and puts them in the session-side
 * SuggestorRegistry, deactivating takes them out. This is also where the
 * suggestors reach the workbench bus: it provides their issue reporter and
 * turns the registry's failures into notifications - the session side stays off
 * the bus (ARCHITECTURE.md 6.1).
 */
@Injectable({ providedIn: "root" })
export class SuggestorFeatureRegistrar implements FeatureContributionRegistrar {
  private readonly suggestorsByFeatureId = new Map<
    string,
    ReadonlyArray<TerminalAutocompleteSuggestorContract>
  >();
  private readonly lastIssueNotificationAt = new Map<string, number>();
  private readonly issueReporter: AutocompleteProviderIssueReporterContract = {
    reportAutocompleteProviderIssue: (issue) => this.reportAutocompleteProviderIssue(issue),
  };

  constructor(
    private readonly suggestorRegistry: SuggestorRegistry,
    private readonly bus: AppBus,
    private readonly configService: ConfigService,
    private readonly filesystem: Filesystem,
    private readonly commandRunner: CommandRunner,
    destroyRef: DestroyRef,
  ) {
    this.suggestorRegistry.issues$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((issue) => this.reportSuggestorIssue(issue));
  }

  register(feature: FeatureDefinition<ActionName>): void {
    for (const suggestor of this.suggestorsFor(feature)) {
      this.suggestorRegistry.register(suggestor);
    }
  }

  unregister(feature: FeatureDefinition<ActionName>): void {
    for (const suggestor of this.suggestorsByFeatureId.get(feature.id) ?? []) {
      this.suggestorRegistry.unregister(suggestor.id);
    }
  }

  private suggestorsFor(
    feature: FeatureDefinition<ActionName>,
  ): ReadonlyArray<TerminalAutocompleteSuggestorContract> {
    const existing = this.suggestorsByFeatureId.get(feature.id);
    if (existing) {
      return existing;
    }
    const suggestors = (feature.autocompleteSuggestors ?? []).map((definition) =>
      definition.createSuggestor({
        filesystem: this.filesystem,
        commandRunner: this.commandRunner,
        issueReporter: this.issueReporter,
        getProviderTimeoutMs: () => this.getProviderTimeoutMs(),
      }),
    );
    this.suggestorsByFeatureId.set(feature.id, suggestors);
    return suggestors;
  }

  /** A session's suggestor failed; the user is told, once per issue. Timeouts stay silent. */
  private reportSuggestorIssue(issue: AutocompleteSuggestorIssue): void {
    this.bus.publish({
      type: "Notification",
      payload: {
        header: "Autocomplete provider failed",
        body: `Provider: ${issue.suggestorId}\nInput: ${issue.input}\n${issue.message}`,
        source: "autocomplete",
        terminalId: issue.terminalId,
        timestamp: new Date(),
        type: "error",
      },
    });
  }

  private reportAutocompleteProviderIssue(issue: AutocompleteProviderIssueContract): void {
    const key = `${issue.suggestorId ?? ""}:${issue.providerId}:${issue.message}`;
    const now = Date.now();
    const lastNotificationAt = this.lastIssueNotificationAt.get(key) ?? 0;
    if (now - lastNotificationAt < AUTOCOMPLETE_PROVIDER_NOTIFICATION_THROTTLE_MS) {
      return;
    }
    this.lastIssueNotificationAt.set(key, now);

    const providerLabel = issue.suggestorId
      ? `${issue.suggestorId}/${issue.providerId}`
      : issue.providerId;
    const commandLine = issue.command ? `Command: ${issue.command}\n` : "";
    this.bus.publish({
      type: "Notification",
      payload: {
        header: "Autocomplete provider failed",
        body: `Provider: ${providerLabel}\n${commandLine}${issue.message}`,
        source: "autocomplete",
        type: "error",
        timestamp: new Date(),
      },
    });
  }

  private getProviderTimeoutMs(): number {
    try {
      return (
        this.configService.config.autocomplete?.provider?.timeout_ms ??
        DEFAULT_AUTOCOMPLETE_PROVIDER_TIMEOUT_MS
      );
    } catch {
      return DEFAULT_AUTOCOMPLETE_PROVIDER_TIMEOUT_MS;
    }
  }
}
