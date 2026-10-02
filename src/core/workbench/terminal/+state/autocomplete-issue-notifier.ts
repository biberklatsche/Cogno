import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  AutocompleteSuggestorIssue,
  SharedSuggestors,
} from "@cogno/core/session/autocomplete/shared-suggestors";
import { AutocompleteProviderIssueContract } from "@cogno/core/session/autocomplete/suggestor.contracts";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";

const PROVIDER_ISSUE_THROTTLE_MS = 10_000;

/**
 * Turns autocomplete failures into notifications. The session side reports
 * them as events and stays off the bus; this is where they reach the user.
 * A spec provider failing repeatedly is reported at most every 10 s.
 */
@Injectable({ providedIn: "root" })
export class AutocompleteIssueNotifier {
  private readonly lastProviderIssueAt = new Map<string, number>();

  constructor(
    sharedSuggestors: SharedSuggestors,
    private readonly bus: AppBus,
    destroyRef: DestroyRef,
  ) {
    sharedSuggestors.issues$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((issue) => this.reportSuggestorIssue(issue));
    sharedSuggestors.providerIssues$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((issue) => this.reportProviderIssue(issue));
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

  private reportProviderIssue(issue: AutocompleteProviderIssueContract): void {
    const key = `${issue.suggestorId ?? ""}:${issue.providerId}:${issue.message}`;
    const now = Date.now();
    if (now - (this.lastProviderIssueAt.get(key) ?? 0) < PROVIDER_ISSUE_THROTTLE_MS) {
      return;
    }
    this.lastProviderIssueAt.set(key, now);

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
}
