import { DestroyRef, Injectable } from "@angular/core";
import { Pairing, PairingRequestContract } from "@cogno/platform";
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
  DialogRef,
  DialogService,
} from "@cogno/shared/ui";
import { PairingService } from "./pairing.service";

/** What a machine is called that does not say how it calls itself. */
const UNNAMED_MACHINE = "machine";

/**
 * `wanted` if no remote has it, else the first of `wanted 2`, `wanted 3`, …
 * that none has. The app names a machine paired by code the same way.
 */
export function uniqueName(wanted: string | null, taken: readonly string[]): string {
  const base = wanted?.trim() || UNNAMED_MACHINE;
  if (!taken.includes(base)) return base;
  let number = 2;
  while (taken.includes(`${base} ${number}`)) number++;
  return `${base} ${number}`;
}

/**
 * Asks the user when another machine wants to pair with this one, and tells
 * the app the answer: the name the machine is a remote under, or none to
 * decline. Both machines show the same check number; the user compares them.
 * Closing the dialog any other way than "Allow" declines; a request that
 * ends first (given up, timed out) closes its dialog unanswered.
 */
@Injectable({ providedIn: "root" })
export class PairingRequestPrompt {
  private readonly open = new Map<number, DialogRef<boolean>>();

  constructor(
    private readonly pairing: Pairing,
    private readonly pairingService: PairingService,
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
        message: `${request.name ?? "A machine"} wants to pair with this machine. Check that it shows ${request.check}.`,
        confirmLabel: "Allow",
        cancelLabel: "Decline",
      },
      closeOnBackdropClick: false,
      width: "32rem",
      maxWidth: "calc(100vw - 2rem)",
    });
    this.open.set(request.id, dialog);
    const allowed = (await dialog.result) ?? false;
    // Over already: nobody waits for the answer.
    if (!this.open.delete(request.id)) return;
    const name = allowed ? uniqueName(request.name, this.pairingService.remoteNames()) : null;
    await this.pairing.answer(request.id, name);
  }

  private end(id: number): void {
    const dialog = this.open.get(id);
    this.open.delete(id);
    dialog?.close(false);
  }
}
