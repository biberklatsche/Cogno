import { Injectable } from "@angular/core";

export interface TerminalDropdownOwner {
  hide(): void;
}

/**
 * App-wide (not per-terminal) coordinator so the autocomplete and history
 * dropdowns never show at the same time, regardless of which terminal/tab
 * they belong to.
 */
@Injectable({ providedIn: "root" })
export class TerminalDropdownCoordinatorService {
  private current: TerminalDropdownOwner | null = null;

  claim(owner: TerminalDropdownOwner): void {
    if (this.current && this.current !== owner) {
      this.current.hide();
    }
    this.current = owner;
  }

  release(owner: TerminalDropdownOwner): void {
    if (this.current === owner) {
      this.current = null;
    }
  }
}
