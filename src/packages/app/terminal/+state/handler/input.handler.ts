import { TerminalId } from "@cogno/core-api";
import { Char, IDisposable } from "@cogno/core-support";
import { IDisposable as IXtermDisposable, Terminal } from "@xterm/xterm";
import { Subscription } from "rxjs";
import { AppBus } from "../../../app-bus/app-bus";
import { IPty } from "../pty/pty";
import { TerminalStateManager } from "../state";
import { ITerminalHandler } from "./handler";

export class InputHandler implements ITerminalHandler {
  private _terminal?: Terminal;
  private subscription: Subscription = new Subscription();
  private terminalInputDisposable?: IXtermDisposable;

  constructor(
    private _bus: AppBus,
    private _terminalId: TerminalId,
    private stateManager: TerminalStateManager,
    private pty: IPty,
  ) {}

  dispose(): void {
    this.terminalInputDisposable?.dispose();
    this.terminalInputDisposable = undefined;
    this.subscription.unsubscribe();
  }

  registerTerminal(terminal: Terminal): IDisposable {
    this._terminal = terminal;
    this.subscription.add(
      this._bus.on$({ path: ["app", "terminal"], type: "ClearBuffer" }).subscribe((event) => {
        if (event.payload !== this._terminalId) return;
        this._terminal?.clear();
      }),
    );
    this.subscription.add(
      this._bus
        .on$({ path: ["app", "terminal"], type: "InjectTerminalInput" })
        .subscribe((event) => {
          if (event.payload?.terminalId !== this._terminalId) return;
          this.pty.write(event.payload.text);
          if (event.payload.appendNewline) {
            queueMicrotask(() => this.pty.write(Char.Enter));
          }
        }),
    );
    this.terminalInputDisposable = terminal.onData(() => {
      this.stateManager.clearUnreadNotification();
    });
    return this;
  }
}
