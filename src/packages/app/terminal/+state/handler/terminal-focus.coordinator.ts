import { FocusHandler } from "@cogno/core/terminal/handlers/focus.handler";
import { TerminalId } from "@cogno/shared/ports";
import { Subscription } from "rxjs";
import { AppBus, MessageBase } from "../../../app-bus/app-bus";
import { TerminalStateManager } from "../state";

export type TerminalFocusedEvent = MessageBase<"TerminalFocused", TerminalId>;
export type TerminalBlurredEvent = MessageBase<"TerminalBlurred", TerminalId>;

/**
 * Everything around focus that is not the machine's business: who asked for
 * it, that the unread badge clears when the user looks at the terminal, and
 * announcing what happened.
 *
 * The machine focuses and reports; this decides when and what follows.
 */
export class TerminalFocusCoordinator {
  private readonly subscription = new Subscription();

  constructor(
    private readonly terminalId: TerminalId,
    private readonly bus: AppBus,
    private readonly stateManager: TerminalStateManager,
    private readonly handler: FocusHandler,
  ) {
    this.subscription.add(
      this.bus.on$({ path: ["app", "terminal"], type: "FocusTerminal" }).subscribe((event) => {
        if (event.payload === this.terminalId) {
          this.handler.focus();
        } else {
          this.handler.blur();
        }
      }),
    );

    this.subscription.add(
      this.bus
        .on$({ path: ["app", "terminal", this.terminalId], type: "PtyInitialized" })
        .subscribe(() => {
          setTimeout(() => this.handler.focus(), 50);
        }),
    );

    this.subscription.add(
      this.bus.on$({ path: ["app", "terminal"], type: "BlurTerminal" }).subscribe((event) => {
        if (event.payload === this.terminalId) {
          this.handler.blur();
        }
      }),
    );
  }

  /** Called by the machine whenever the terminal gained or lost the keyboard. */
  onFocusChanged(focused: boolean): void {
    this.stateManager.setFocus(focused);
    if (focused) {
      this.stateManager.clearUnreadNotification();
      this.bus.publish({ type: "TerminalFocused", payload: this.terminalId });
    } else {
      this.bus.publish({ type: "TerminalBlurred", payload: this.terminalId });
    }
  }

  focus(): void {
    this.handler.focus();
  }

  hasFocus(): boolean {
    return this.handler.hasFocus();
  }

  dispose(): void {
    this.subscription.unsubscribe();
  }
}
