import { Injectable } from "@angular/core";

const DISCARD_SESSION_STORAGE_KEY = "cogno.workspace.discard-session";

/**
 * "Delete the saved session at the next launch." The open terminals still hold
 * the old output and keep being saved until the app quits, so the one moment the
 * stored session can be deleted for good is the start, before anything loads.
 * Kept in the browser store: all windows share it and it is read synchronously.
 */
@Injectable({ providedIn: "root" })
export class DiscardSessionMarker {
  get isSet(): boolean {
    try {
      return window.localStorage.getItem(DISCARD_SESSION_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  }

  set(): void {
    try {
      window.localStorage.setItem(DISCARD_SESSION_STORAGE_KEY, "1");
    } catch {
      // ignore storage access errors
    }
  }

  clear(): void {
    try {
      window.localStorage.removeItem(DISCARD_SESSION_STORAGE_KEY);
    } catch {
      // ignore storage access errors
    }
  }
}
