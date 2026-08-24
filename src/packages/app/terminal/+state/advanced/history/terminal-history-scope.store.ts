import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";
import { HistoryScope } from "./recent-history.types";

const SCOPE_STORAGE_KEY = "terminal.history.scope";

/**
 * App-wide source of truth for the history panel's scope (global/cwd/session). Provided in root
 * so every terminal tab shares one instance: cycling the scope in one tab updates all others, and
 * a newly opened tab starts in the current scope. The scope is only the *mode* — each tab still
 * resolves its own entries from its own cwd/session context, so shared scope never mixes histories.
 */
@Injectable({ providedIn: "root" })
export class TerminalHistoryScopeStore {
  private readonly _scope = new BehaviorSubject<HistoryScope>(this.load());

  get scope(): HistoryScope {
    return this._scope.value;
  }

  get scope$(): Observable<HistoryScope> {
    return this._scope.asObservable();
  }

  cycle(): void {
    this.set(this.nextScope(this._scope.value));
  }

  set(scope: HistoryScope): void {
    if (scope === this._scope.value) return;
    this._scope.next(scope);
    this.save(scope);
  }

  private nextScope(scope: HistoryScope): HistoryScope {
    if (scope === "global") return "cwd";
    if (scope === "cwd") return "session";
    return "global";
  }

  private load(): HistoryScope {
    try {
      const raw = window.localStorage.getItem(SCOPE_STORAGE_KEY);
      if (raw === "global" || raw === "cwd" || raw === "session") {
        return raw;
      }
    } catch {
      // ignore storage access errors
    }
    return "global";
  }

  private save(scope: HistoryScope): void {
    try {
      window.localStorage.setItem(SCOPE_STORAGE_KEY, scope);
    } catch {
      // ignore storage access errors
    }
  }
}
