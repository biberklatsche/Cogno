import { Injectable } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Observable } from "rxjs";
import { fromTauriListener } from "./tauri-listener";

const UPDATER_STATE_EVENT = "updater-state";

export type UpdaterPhase =
  | "idle"
  | "checking"
  | "upToDate"
  | "available"
  | "downloading"
  | "ready"
  | "failed";

/** The app's one update state; Rust owns it and broadcasts every change to all windows. */
export interface UpdaterState {
  readonly phase: UpdaterPhase;
  readonly currentVersion: string;
  /** The version on offer, while one is available, downloading or ready. */
  readonly version: string | null;
  readonly notes: string | null;
  /** False when this installation cannot replace itself; then only the download page helps. */
  readonly installable: boolean;
  readonly error: string | null;
}

@Injectable({ providedIn: "root" })
export class Updater {
  /** The current state first, then every change. */
  readonly state$: Observable<UpdaterState> = fromTauriListener<UpdaterState>(
    (emit) => listen<UpdaterState>(UPDATER_STATE_EVENT, ({ payload }) => emit(payload)),
    () => invoke<UpdaterState>("updater_state"),
  );

  /**
   * Asks for a check. Without `force`, a check shortly after the last one is
   * skipped, so every window may ask on its own schedule. With `download`, an
   * installable update is fetched right away.
   */
  check(options: { force: boolean; download: boolean }): Promise<void> {
    return invoke("updater_check", options);
  }

  /** Installs the update - downloading it first when needed - and restarts the app. */
  install(): Promise<void> {
    return invoke("updater_install");
  }
}
