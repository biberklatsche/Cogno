import { Injectable } from "@angular/core";
import { AppWiringService } from "@cogno/app/app-host/app-wiring.service";
import {
  AutocompleteProviderIssueContract,
  AutocompleteProviderIssueReporterContract,
  CommandRunner,
  Filesystem,
  ShellTypeContract,
  TerminalAutocompleteSuggestorContract,
} from "@cogno/core-api";
import { AppBus } from "../app-bus/app-bus";
import { ConfigService } from "../config/+state/config.service";

const AUTOCOMPLETE_PROVIDER_NOTIFICATION_THROTTLE_MS = 10_000;
const DEFAULT_AUTOCOMPLETE_PROVIDER_TIMEOUT_MS = 160;

@Injectable({ providedIn: "root" })
export class TerminalAutocompleteFeatureSuggestorService {
  private sharedSuggestors?: ReadonlyArray<TerminalAutocompleteSuggestorContract>;
  private readonly lastIssueNotificationAt = new Map<string, number>();
  private readonly issueReporter: AutocompleteProviderIssueReporterContract = {
    reportAutocompleteProviderIssue: (issue) => this.reportAutocompleteProviderIssue(issue),
  };

  constructor(
    private readonly wiringService: AppWiringService,
    private readonly bus: AppBus,
    private readonly configService: ConfigService,
    private readonly filesystem: Filesystem,
    private readonly commandRunner: CommandRunner,
  ) {}

  getSharedSuggestors(): ReadonlyArray<TerminalAutocompleteSuggestorContract> {
    if (!this.sharedSuggestors) {
      this.sharedSuggestors = this.wiringService
        .getTerminalAutocompleteSuggestorDefinitions()
        .map((definition) =>
          definition.createSuggestor({
            filesystem: this.filesystem,
            commandRunner: this.commandRunner,
            issueReporter: this.issueReporter,
            getProviderTimeoutMs: () => this.getProviderTimeoutMs(),
          }),
        );
    }

    return this.sharedSuggestors;
  }

  preloadForShellIntegration(shellType: ShellTypeContract): void {
    for (const suggestor of this.getSharedSuggestors()) {
      void suggestor.warmUpForShellIntegration?.(shellType);
    }
  }

  private reportAutocompleteProviderIssue(issue: AutocompleteProviderIssueContract): void {
    const key = `${issue.suggestorId ?? ""}:${issue.providerId}:${issue.kind}:${issue.message}`;
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
      path: ["notification"],
      payload: {
        header:
          issue.kind === "timeout"
            ? "Autocomplete provider timed out"
            : "Autocomplete provider failed",
        body: `Provider: ${providerLabel}\n${commandLine}${issue.message}`,
        source: "autocomplete",
        type: issue.kind === "timeout" ? "warning" : "error",
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
