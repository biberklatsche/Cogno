import { DestroyRef, Injectable } from "@angular/core";
import { AskpassRequest, AskpassRequests } from "@cogno/platform";
import { DialogRef, DialogService } from "@cogno/shared/ui";
import { classifyProcessPrompt, ProcessPrompt } from "./process-prompt";
import { ProcessPromptDialogComponent } from "./process-prompt-dialog.component";

/**
 * Shows the prompts of processes the command runner started in this window
 * (credentials, passphrases, host keys - ARCHITECTURE.md 2.1) and sends the
 * answer back. One dialog per prompt, in the order they arrive.
 */
@Injectable({ providedIn: "root" })
export class ProcessPromptService {
  private readonly open = new Map<string, DialogRef<string>>();

  constructor(
    private readonly askpass: AskpassRequests,
    private readonly dialogs: DialogService,
    destroyRef: DestroyRef,
  ) {
    void askpass
      .onRequest((request) => this.show(request))
      .then((unlisten) => destroyRef.onDestroy(unlisten));
    void askpass
      .onClosed((requestId) => this.open.get(requestId)?.close())
      .then((unlisten) => destroyRef.onDestroy(unlisten));
  }

  private show(request: AskpassRequest): void {
    const prompt = classifyProcessPrompt(request.prompt);
    const ref = this.dialogs.open<ProcessPrompt, string>(ProcessPromptDialogComponent, {
      title: "A command asks for input",
      data: prompt,
      closeOnBackdropClick: false,
      width: "32rem",
      maxWidth: "calc(100vw - 2rem)",
    });
    this.open.set(request.requestId, ref);
    const close = ref.close.bind(ref);
    ref.close = (answer?: string) => {
      if (this.open.delete(request.requestId)) {
        void this.askpass.answer(request.requestId, answer ?? null);
      }
      close(answer);
    };
  }
}
