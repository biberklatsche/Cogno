import { IDisposable } from "@cogno/shared/support";
import { Terminal } from "@xterm/xterm";
import { Subscription } from "rxjs";
import { ITerminalHandler } from "../terminal-handler";
import type { TerminalMachineState } from "../terminal-machine.state";

export class SelectionHandler implements ITerminalHandler {
  private subscription: Subscription = new Subscription();
  private terminal?: Terminal;

  constructor(private terminalStateManager: TerminalMachineState) {}

  dispose(): void {
    this.subscription.unsubscribe();
  }

  registerTerminal(terminal: Terminal): IDisposable {
    this.terminal = terminal;
    this.syncSelectionState();
    const selectionDisposable = this.terminal.onSelectionChange(() => {
      this.syncSelectionState();
    });
    this.subscription.add(() => selectionDisposable.dispose());
    return this;
  }

  hasSelection(): boolean {
    return this.terminal?.hasSelection() ?? false;
  }

  getSelection(): string {
    return this.terminal?.getSelection() ?? "";
  }

  getSelectionPosition() {
    return this.terminal?.getSelectionPosition();
  }

  clearSelection(): void {
    this.terminal?.clearSelection();
    this.syncSelectionState();
  }

  private syncSelectionState(): void {
    this.terminalStateManager.setHasSelection(this.hasSelection());
  }
}
