import { Injectable } from "@angular/core";

/**
 * The action names features contribute, for the action catalogue. The
 * feature-host fills this in its declaration phase - names are known
 * independent of mode, so CLI, HTTP and the palette can offer them whether or
 * not the feature is on (ARCHITECTURE.md 6.1). Action handlers are a separate,
 * activation-time concern and arrive when a feature declares one.
 */
@Injectable({ providedIn: "root" })
export class ActionNameRegistry {
  private readonly names = new Set<string>();

  register(actionNames: ReadonlyArray<string>): void {
    for (const actionName of actionNames) {
      this.names.add(actionName);
    }
  }

  getActionNames(): ReadonlyArray<string> {
    return [...this.names];
  }

  /** True when a feature declared this action name (known, regardless of mode). */
  has(actionName: string): boolean {
    return this.names.has(actionName);
  }
}
