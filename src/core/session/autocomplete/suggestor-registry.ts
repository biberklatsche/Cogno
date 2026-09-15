import { Injectable } from "@angular/core";
import { TerminalAutocompleteSuggestorContract } from "@cogno/shared/contributions";
import { ShellTypeContract } from "@cogno/shared/domain";
import { BehaviorSubject, Observable, Subject } from "rxjs";

/** A suggestor of a session's autocomplete failed while a session used it. */
export type AutocompleteSuggestorIssue = {
  readonly kind: "timeout" | "error";
  readonly suggestorId: string;
  readonly message: string;
  readonly input: string;
  readonly terminalId?: string;
};

/**
 * The feature-contributed suggestors, as a live set every session follows
 * (ARCHITECTURE.md 6.1). The feature-host registers and unregisters them as
 * features come and go; each session subscribes and rebuilds its autocomplete
 * sources, so a suggestor turned on reaches running sessions at once and later
 * sessions when they start. The registry is pure session state - it never
 * reaches the workbench bus; a failing suggestor is reported as an event the
 * workbench observes and turns into a notification.
 */
@Injectable({ providedIn: "root" })
export class SuggestorRegistry {
  private readonly suggestors = new BehaviorSubject<
    ReadonlyArray<TerminalAutocompleteSuggestorContract>
  >([]);
  private readonly issues = new Subject<AutocompleteSuggestorIssue>();

  /** The current set of feature-contributed suggestors. */
  readonly suggestors$: Observable<ReadonlyArray<TerminalAutocompleteSuggestorContract>> =
    this.suggestors.asObservable();

  /** Suggestor failures, for the workbench to turn into notifications. */
  readonly issues$: Observable<AutocompleteSuggestorIssue> = this.issues.asObservable();

  register(suggestor: TerminalAutocompleteSuggestorContract): void {
    if (this.suggestors.value.some((existing) => existing.id === suggestor.id)) {
      return;
    }
    this.suggestors.next([...this.suggestors.value, suggestor]);
  }

  unregister(suggestorId: string): void {
    const next = this.suggestors.value.filter((suggestor) => suggestor.id !== suggestorId);
    if (next.length !== this.suggestors.value.length) {
      this.suggestors.next(next);
    }
  }

  /** Warm up every registered suggestor for a shell that just authenticated. */
  preloadForShellIntegration(shellType: ShellTypeContract): void {
    for (const suggestor of this.suggestors.value) {
      void suggestor.warmUpForShellIntegration?.(shellType);
    }
  }

  reportIssue(issue: AutocompleteSuggestorIssue): void {
    this.issues.next(issue);
  }
}
