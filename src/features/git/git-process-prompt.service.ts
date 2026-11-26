import { Injectable } from "@angular/core";
import {
  ProcessAnswers,
  ProcessCredentialAnswer,
  ProcessCredentialRequest,
} from "@cogno/core/api/command-runner-port";
import { DialogService } from "@cogno/shared/ui";
import { GitRemoteAccessService } from "./git-remote-access.service";
import { GitViewState } from "./git-view-state.service";
import { gitHostFor } from "./hosts/git-hosts";
import { classifyGitPrompt, GitPrompt } from "./model/git-process-prompt";
import { hostOf } from "./model/git-remote-url";
import {
  GitCredentialDialogComponent,
  GitCredentialDialogData,
  GitCredentialDialogResult,
} from "./ui/git-credential-dialog.component";
import { GitProcessPromptDialogComponent } from "./ui/git-process-prompt-dialog.component";

/** Who answers one git run, and what became of its access. */
export type GitRunPrompts = {
  readonly answers: ProcessAnswers;
  /** True once a credential request was dismissed; the run's failure needs no toast then. */
  readonly refused: () => boolean;
  /** The origin git reported its credential as rejected for, if it did. */
  readonly rejectedFor: () => string | null;
};

/**
 * Answers what a git run asks without a terminal. Credentials for https come
 * as a request for an origin: the dialog signs in in the browser or takes a
 * token. What the ssh git starts asks - a passphrase, a host key - comes as
 * prompt text, one dialog per prompt. Dismissing a credential request means
 * the person has nothing to give right now: the failed run is not reported on
 * top of it.
 */
@Injectable({ providedIn: "root" })
export class GitProcessPromptService {
  constructor(
    private readonly dialogs: DialogService,
    private readonly access: GitRemoteAccessService,
    private readonly view: GitViewState,
  ) {}

  /** Answers for one run; each run gets its own, so nothing is charged to another. */
  forRun(): GitRunPrompts {
    let refused = false;
    let rejectedFor: string | null = null;
    return {
      answers: {
        prompt: (prompt) => this.show(classifyGitPrompt(prompt.text), prompt.closed),
        credential: async (request) => {
          const result = await this.askCredential(request);
          if (request.closed.aborted) return null;
          if (result === "other") void this.access.open(request.origin);
          if (result === undefined || result === "other") {
            refused = true;
            return null;
          }
          return result;
        },
        credentialRejected: (origin) => {
          rejectedFor = origin;
        },
      },
      refused: () => refused,
      rejectedFor: () => rejectedFor,
    };
  }

  private askCredential(
    request: ProcessCredentialRequest,
  ): Promise<ProcessCredentialAnswer | "other" | undefined> {
    const host = hostOf(request.origin) ?? request.origin;
    const definition = gitHostFor(host, this.view.hosts());
    const ref = this.dialogs.open<GitCredentialDialogData, GitCredentialDialogResult>(
      GitCredentialDialogComponent,
      {
        title: `Sign in to ${host}`,
        data: {
          origin: request.origin,
          host,
          label: definition.label,
          provider: definition.signIn?.(host) ?? null,
          token: definition.token,
        },
        closeOnBackdropClick: false,
        width: "32rem",
        maxWidth: "calc(100vw - 2rem)",
      },
    );
    request.closed.addEventListener("abort", () => ref.close(), { once: true });
    return ref.result;
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
