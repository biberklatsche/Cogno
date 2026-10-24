import { Injectable } from "@angular/core";
import { ProcessPromptRequest } from "@cogno/core/api/command-runner-port";
import { DialogService } from "@cogno/shared/ui";
import { ProcessPromptDialogComponent } from "./process-prompt-dialog.component";

/**
 * The prompt dialog for a run whose feature gave no handler of its own
 * (ARCHITECTURE.md 2.1): the process's text and one hidden field, because the
 * workbench cannot know whether the answer is a secret. Features that know
 * their process answer its prompts themselves.
 */
@Injectable({ providedIn: "root" })
export class ProcessPromptService {
  constructor(private readonly dialogs: DialogService) {}

  ask(prompt: ProcessPromptRequest): Promise<string | null> {
    const ref = this.dialogs.open<string, string>(ProcessPromptDialogComponent, {
      title: "A command asks for input",
      data: prompt.text,
      closeOnBackdropClick: false,
      width: "32rem",
      maxWidth: "calc(100vw - 2rem)",
    });
    prompt.closed.addEventListener("abort", () => ref.close(), { once: true });
    return ref.result.then((answer) => answer ?? null);
  }
}
