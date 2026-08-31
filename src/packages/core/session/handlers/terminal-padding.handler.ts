import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import type { IRenderer } from "@cogno/core/terminal/renderer";
import { ITerminalHandler } from "@cogno/core/terminal/terminal-handler";
import { IDisposable } from "@cogno/shared/support";
import { Terminal } from "@xterm/xterm";
import { Subscription } from "rxjs";
import { SessionModel } from "../model/session-model";

/**
 * Padding around the terminal, and what has to happen when a full-screen
 * application takes over. Reacting to the alt screen is session work; the
 * machine only reports that it happened (ARCHITECTURE.md 2.1). Listens to
 * the session's own facts, so nothing outside needs to relay them.
 */
export class TerminalPaddingHandler implements ITerminalHandler {
  private readonly subscription = new Subscription();

  constructor(
    private readonly model: SessionModel,
    private readonly configService: ConfigService,
    private readonly terminalContainer: HTMLDivElement,
    private readonly renderer: IRenderer,
  ) {}

  dispose(): void {
    this.subscription.unsubscribe();
  }

  registerTerminal(_terminal: Terminal): IDisposable {
    this.subscription.add(
      this.model.facts$.subscribe((fact) => {
        switch (fact.type) {
          case "fullScreenChanged":
            if (!this.configService.config.padding?.remove_on_full_screen_app) return;
            if (fact.active) {
              this.removePadding();
            } else {
              this.restorePadding();
            }
            break;
          case "promptReported":
            this.renderer.restoreCursorColor();
            break;
        }
      }),
    );
    return this;
  }

  private removePadding(): void {
    this.terminalContainer.style.setProperty("--padding-xterm", "0");
    this.terminalContainer.style.setProperty("--padding", "0");
    this.terminalContainer.style.backgroundColor = "var(--background-color)";
    this.model.report({ type: "paddingChanged", removed: true });
  }

  private restorePadding(): void {
    this.terminalContainer.style.removeProperty("--padding-xterm");
    this.terminalContainer.style.removeProperty("--padding");
    this.terminalContainer.style.backgroundColor = "";
    this.model.report({ type: "paddingChanged", removed: false });
  }
}
