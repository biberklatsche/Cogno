import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import type { IRenderer } from "@cogno/core/terminal/renderer";
import { ITerminalHandler } from "@cogno/core/terminal/terminal-handler";
import { TerminalId } from "@cogno/shared/ports";
import { IDisposable } from "@cogno/shared/support";
import { Terminal } from "@xterm/xterm";
import { Subscription } from "rxjs";
import { AppBus, MessageBase } from "../../../app-bus/app-bus";

export type TerminalThemeChangedEvent = MessageBase<"TerminalThemeChanged", TerminalId>;
export type TerminalThemePaddingAddedEvent = MessageBase<"TerminalThemePaddingAdded", TerminalId>;
export type TerminalThemePaddingRemovedEvent = MessageBase<
  "TerminalThemePaddingRemoved",
  TerminalId
>;
export type TerminalCursorRestoreRequestedEvent = MessageBase<
  "TerminalCursorRestoreRequested",
  TerminalId
>;

/**
 * Padding around the terminal, and what has to happen when a full-screen
 * application takes over. Reacting to the alt screen is session work; the
 * machine only reports that it happened (ARCHITECTURE.md 2.1).
 */
export class TerminalPaddingHandler implements ITerminalHandler {
  private readonly subscription = new Subscription();

  constructor(
    private _terminalId: TerminalId,
    private _configService: ConfigService,
    private _bus: AppBus,
    private _terminalContainer: HTMLDivElement,
    private _renderer: IRenderer,
  ) {}

  dispose(): void {
    this.subscription?.unsubscribe();
  }

  registerTerminal(_terminal: Terminal): IDisposable {
    this.subscription.add(
      this._bus
        .on$({ type: "FullScreenAppLeaved", path: ["app", "terminal", this._terminalId] })
        .subscribe(() => {
          if (this._configService.config.padding?.remove_on_full_screen_app) {
            this._terminalContainer.style.removeProperty("--padding-xterm");
            this._terminalContainer.style.removeProperty("--padding");
            this._terminalContainer.style.backgroundColor = "";
            this._bus.publish({
              path: ["app", "terminal", this._terminalId],
              type: "TerminalThemePaddingAdded",
            });
          }
        }),
    );
    this.subscription.add(
      this._bus
        .on$({ type: "FullScreenAppEntered", path: ["app", "terminal", this._terminalId] })
        .subscribe(() => {
          if (this._configService.config.padding?.remove_on_full_screen_app) {
            this._terminalContainer.style.setProperty("--padding-xterm", "0");
            this._terminalContainer.style.setProperty("--padding", "0");
            this._terminalContainer.style.backgroundColor = "var(--background-color)";
            this._bus.publish({
              path: ["app", "terminal", this._terminalId],
              type: "TerminalThemePaddingRemoved",
            });
          }
        }),
    );
    this.subscription.add(
      this._bus
        .on$({
          type: "TerminalCursorRestoreRequested",
          path: ["app", "terminal", this._terminalId],
        })
        .subscribe(() => {
          this._renderer.restoreCursorColor();
        }),
    );
    return this;
  }
}
