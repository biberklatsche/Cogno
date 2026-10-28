import { Injectable } from "@angular/core";
import { ProcessPromptHandler } from "@cogno/core/api/command-runner-port";
import { DialogService } from "@cogno/shared/ui";
import { GitRemoteAccessService } from "./git-remote-access.service";
import { classifyGitPrompt, GitPrompt } from "./model/git-process-prompt";
import { GitProcessPromptDialogComponent } from "./ui/git-process-prompt-dialog.component";

/** The prompts of one git run: the handler to give it, and whether the person refused one. */
export type GitRunPrompts = {
  readonly handler: ProcessPromptHandler;
  /** True once a credential prompt was dismissed; the run's failure needs no toast then. */
  readonly refused: () => boolean;
};

/**
 * Answers what git and the ssh it starts would ask on a terminal: credentials,
 * a passphrase, a host key. One dialog per prompt, read from the prompt text.
 * Dismissing a credential prompt means no helper served the host and the
 * person has nothing to type: the access dialog takes over, and the failed
 * run is not reported on top of it.
 */
@Injectable({ providedIn: "root" })
export class GitProcessPromptService {
  constructor(
    private readonly dialogs: DialogService,
    private readonly access: GitRemoteAccessService,
  ) {}

  /** Prompts for one run; each run gets its own, so a refusal is never charged to another. */
  forRun(): GitRunPrompts {
    let refused = false;
    return {
      handler: async (prompt) => {
        const classified = classifyGitPrompt(prompt.text);
        const answer = await this.show(classified, prompt.closed);
        if (answer === null && !prompt.closed.aborted && classified.url) {
          refused = true;
          void this.access.open(classified.url);
        }
        return answer;
      },
      refused: () => refused,
    };
  }

  private show(prompt: GitPrompt, closed: AbortSignal): Promise<string | null> {
    const ref = this.dialogs.open<GitPrompt, string>(GitProcessPromptDialogComponent, {
      title: "Git asks for input",
      data: prompt,
      closeOnBackdropClick: false,
      width: "32rem",
      maxWidth: "calc(100vw - 2rem)",
    });
    closed.addEventListener("abort", () => ref.close(), { once: true });
    return ref.result.then((answer) => answer ?? null);
  }
}
