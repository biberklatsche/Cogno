import { MachineState } from "@cogno/core/terminal/machine-state";
import { ITerminalHandler } from "@cogno/core/terminal/terminal-handler";
import { IDisposable } from "@cogno/shared/support";
import { Terminal } from "@xterm/xterm";
import { SessionModel } from "../model/session-model";

/**
 * Notices when a full-screen program (vim, helix, ...) takes the terminal
 * over or hands it back, from the sequences such programs send. Records it
 * on the machine state and states it as a fact.
 */
export class FullScreenAppHandler implements ITerminalHandler {
  private readonly _disposables: IDisposable[] = [];
  private static readonly ALTERNATE_SCREEN_PARAMS = new Set([47, 1047, 1049]);
  private static readonly HELIX_MOUSE_TRACKING_PARAMS = [1003, 1006] as const;

  constructor(
    private readonly model: SessionModel,
    private readonly machine: MachineState,
  ) {}

  dispose(): void {
    this._disposables.forEach((disposable) => {
      disposable?.dispose();
    });
  }

  private publishEntered(): void {
    this.machine.setInFullScreenMode(true);
    this.model.report({ type: "fullScreenChanged", active: true });
  }

  private publishLeaved(): void {
    this.machine.setInFullScreenMode(false);
    this.model.report({ type: "fullScreenChanged", active: false });
  }

  private isAlternateScreenSequence(params: readonly (number | readonly number[])[]): boolean {
    return params.some(
      (param) =>
        typeof param === "number" && FullScreenAppHandler.ALTERNATE_SCREEN_PARAMS.has(param),
    );
  }

  private isExactNumericSequence(
    params: readonly (number | readonly number[])[],
    expected: readonly number[],
  ): boolean {
    return (
      params.length === expected.length &&
      params.every((param, index) => typeof param === "number" && param === expected[index])
    );
  }

  registerTerminal(terminal: Terminal): IDisposable {
    this._disposables.push(
      terminal.parser.registerCsiHandler({ final: "t" }, (n) => {
        if (n.length === 3 && n[0] === 22 && n[1] === 0 && n[2] === 0) {
          // Restore Window (Vim on Gitbash uses this)
          this.publishEntered();
        }
        if (n.length === 3 && n[0] === 23 && n[1] === 0 && n[2] === 0) {
          // Save Window (Vim on Gitbash uses this)
          this.publishLeaved();
        }
        return false;
      }),
    );

    this._disposables.push(
      terminal.parser.registerCsiHandler({ prefix: "?", final: "h" }, (n) => {
        if (this.isAlternateScreenSequence(n)) {
          // alternate screen buffer (vim and other TUIs use this)
          this.publishEntered();
        }
        if (this.isExactNumericSequence(n, FullScreenAppHandler.HELIX_MOUSE_TRACKING_PARAMS)) {
          // enable mouse tracking (helix uses this)
          this.publishLeaved();
        }
        return false;
      }),
    );
    this._disposables.push(
      terminal.parser.registerCsiHandler({ prefix: "?", final: "l" }, (n) => {
        if (this.isExactNumericSequence(n, FullScreenAppHandler.HELIX_MOUSE_TRACKING_PARAMS)) {
          // disable mouse tracking (helix uses this)
          this.publishEntered();
        }
        if (this.isAlternateScreenSequence(n)) {
          // back to normal screen buffer (vim and other TUIs use this)
          this.publishLeaved();
        }
        return false;
      }),
    );
    return this;
  }
}
