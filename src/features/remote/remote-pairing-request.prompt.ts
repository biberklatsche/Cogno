import { Injectable } from "@angular/core";
import { Pairing, PairingRequestContract } from "@cogno/platform";
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
  DialogRef,
  DialogService,
} from "@cogno/shared/ui";

/** How wide the question is, and how wide at most in a narrow window. */
const DIALOG_WIDTH = "32rem";
const DIALOG_MAX_WIDTH = "calc(100vw - 2rem)";

/**
 * Asks the user when another machine wants to pair with this one, and tells
 * the app the answer. Both machines show the same check number; the user
 * compares them and says so on both. Closing the dialog any other way than
 * "They match" declines; a request that ends first (declined there, given
 * up, timed out) closes its dialog unanswered.
 */
@Injectable({ providedIn: "root" })
export class RemotePairingRequestPrompt {
  private readonly open = new Map<number, DialogRef<boolean>>();

  /** What ends the listening, while it listens. */
  private listening?: Promise<ReadonlyArray<() => void>>;

  constructor(
    private readonly pairing: Pairing,
    private readonly dialogs: DialogService,
  ) {}

  /** Takes the requests from now on; a no-op while it does. */
  listen(): void {
    this.listening ??= Promise.all([
      this.pairing.onRequest((request) => void this.ask(request)),
      this.pairing.onRequestEnded((id) => this.end(id)),
    ]);
  }

  /** Takes no requests any more: the feature is off, and nothing of it stays. */
  stop(): void {
    void this.listening?.then((unlisten) => {
      for (const end of unlisten) end();
    });
    this.listening = undefined;
  }

  private async ask(request: PairingRequestContract): Promise<void> {
    const dialog = this.dialogs.open<ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      title: "Pairing",
      data: {
        message: `${request.name} wants to pair with this machine. Does it show ${request.check}?`,
        confirmLabel: "They match",
        cancelLabel: "Decline",
      },
      closeOnBackdropClick: false,
      width: DIALOG_WIDTH,
      maxWidth: DIALOG_MAX_WIDTH,
    });
    this.open.set(request.id, dialog);
    const confirmed = (await dialog.result) ?? false;
    // Over already: nobody waits for the answer.
    if (!this.open.delete(request.id)) return;
    await this.pairing.answer(request.id, confirmed);
  }

  private end(id: number): void {
    const dialog = this.open.get(id);
    this.open.delete(id);
    dialog?.close(false);
  }
}
