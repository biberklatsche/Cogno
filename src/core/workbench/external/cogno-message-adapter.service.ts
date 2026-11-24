import { DestroyRef, Injectable } from "@angular/core";
import { CognoMessageListener } from "@cogno/platform/cogno-message";
import { CognoMessageDispatcher } from "./cogno-message-dispatcher.service";

/**
 * Hands what processes say to Cogno - a coding agent's hooks, through the
 * host of the machine they run on - to the dispatcher.
 */
@Injectable({
  providedIn: "root",
})
export class CognoMessageAdapterService {
  constructor(
    cognoMessages: CognoMessageListener,
    dispatcher: CognoMessageDispatcher,
    ref: DestroyRef,
  ) {
    cognoMessages
      .register((message) => {
        dispatcher.dispatch(message);
      })
      .then((unlisten) => {
        ref.onDestroy(() => unlisten());
      });
  }
}
