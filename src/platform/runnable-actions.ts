import { Injectable } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";

/**
 * Which actions `cogno action run` in a terminal may run: the app answers it
 * from this list (dispatched, inactive, or unknown) without asking the webview.
 */
@Injectable({ providedIn: "root" })
export class RunnableActions {
  /** Tells the backend which actions dispatch now and which are inactive. */
  set(dispatched: ReadonlyArray<string>, inactive: ReadonlyArray<string>): Promise<void> {
    return invoke<void>("set_runnable_actions", {
      dispatched: [...dispatched],
      inactive: [...inactive],
    });
  }
}
