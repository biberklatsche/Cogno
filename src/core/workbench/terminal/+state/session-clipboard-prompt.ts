import { Injectable } from "@angular/core";
import { TerminalPlacementPort } from "@cogno/core/api/terminal-placement-port";
import { SessionHost } from "@cogno/core/session/host/session-host";
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
  DialogRef,
  DialogService,
} from "@cogno/shared/ui";
import { Subscription } from "rxjs";

/**
 * Asks the user when a program in this session wants to read the clipboard
 * (OSC 52 with `clipboard.read = ask`) and tells the session the answer.
 * Closing the dialog any other way than "Allow" refuses. The dialog names the
 * terminal: it opens over whatever is showing, also for a tab in the background.
 */
@Injectable()
export class SessionClipboardPrompt {
  private readonly subscription = new Subscription();
  private openDialog?: DialogRef<boolean>;

  constructor(
    private readonly host: SessionHost,
    private readonly dialogs: DialogService,
    private readonly placements: TerminalPlacementPort,
  ) {
    this.subscription.add(
      this.host.facts$.subscribe((fact) => {
        if (fact.type === "clipboardReadRequested") void this.ask();
        if (fact.type === "clipboardReadExpired") this.openDialog?.close(false);
      }),
    );
  }

  dispose(): void {
    this.subscription.unsubscribe();
    this.openDialog?.close(false);
  }

  private async ask(): Promise<void> {
    const dialog = this.dialogs.open<ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      title: "Clipboard Access",
      data: {
        message: `A program in ${this.terminalName()} wants to read the clipboard. Allow it only if you expect that - output from a file or a remote host can ask for it, too.`,
        confirmLabel: "Allow",
        cancelLabel: "Deny",
      },
      closeOnBackdropClick: false,
      width: "32rem",
      maxWidth: "calc(100vw - 2rem)",
    });
    this.openDialog = dialog;
    const allowed = (await dialog.result) ?? false;
    this.openDialog = undefined;
    await this.host.answerClipboardRead(allowed);
  }

  /** The asking terminal by tab and workspace, as the user sees them. */
  private terminalName(): string {
    const terminalId = this.host.terminalId;
    const placement = terminalId ? this.placements.getPlacement(terminalId) : undefined;
    if (!placement) return "a terminal";
    const tab = placement.tabTitle ? `"${placement.tabTitle}"` : `${placement.tabIndex + 1}`;
    return `the terminal in tab ${tab} of workspace "${placement.workspaceName}"`;
  }
}
