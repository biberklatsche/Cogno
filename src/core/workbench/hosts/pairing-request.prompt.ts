import { DestroyRef, Injectable } from "@angular/core";
import { Pairing, PairingRequestContract } from "@cogno/platform";
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
  DialogRef,
  DialogService,
} from "@cogno/shared/ui";

/**
 * Asks the user when another machine wants to pair with this one, and tells
 * the app the answer. Both machines show the same check number; the user
 * compares them and says so on both. Closing the dialog any other way than
 * "They match" declines; a request that ends first (declined there, given
 * up, timed out) closes its dialog unanswered.
 */
@Injectable({ providedIn: "root" })
export class PairingRequestPrompt {
  private readonly open = new Map<number, DialogRef<boolean>>();

  constructor(
    private readonly pairing: Pairing,
    private readonly dialogs: DialogService,
    destroyRef: DestroyRef,
  ) {
    void pairing
      .onRequest((request) => void this.ask(request))
      .then((unlisten) => destroyRef.onDestroy(unlisten));
    void pairing
      .onRequestEnded((id) => this.end(id))
      .then((unlisten) => destroyRef.onDestroy(unlisten));
  }

  private async ask(request: PairingRequestContract): Promise<void> {
    const dialog = this.dialogs.open<ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      title: "Pairing",
      data: {
        message: `${request.name ?? "A machine"} wants to pair with this machine. Does it show ${request.check}?`,
        confirmLabel: "They match",
        cancelLabel: "Decline",
      },
      closeOnBackdropClick: false,
      width: "32rem",
      maxWidth: "calc(100vw - 2rem)",
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
