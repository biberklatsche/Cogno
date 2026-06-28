import { Injectable } from "@angular/core";

export interface TerminalDropdownOwner {
  hide(): void;
  dispatchKeydown(event: KeyboardEvent): void;
}

/**
 * App-wide (not per-terminal) coordinator so the autocomplete and history
 * dropdowns never show at the same time, regardless of which terminal/tab
 * they belong to.
 *
 * Owns the single global keydown capture listener so per-terminal dropdown
 * services don't each add their own (which would scale with tab count).
 */
@Injectable({ providedIn: "root" })
export class TerminalDropdownCoordinatorService {
  private current: TerminalDropdownOwner | null = null;

  constructor() {
    window.addEventListener("keydown", (event) => this.current?.dispatchKeydown(event), {
      capture: true,
    });
  }

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
