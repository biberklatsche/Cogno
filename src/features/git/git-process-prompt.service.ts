import { Injectable } from "@angular/core";
import {
  ProcessCredentialAnswer,
  ProcessCredentialRequest,
} from "@cogno/core/api/command-runner-port";
import { DialogService } from "@cogno/shared/ui";
import { GitRemoteAccessService } from "./git-remote-access.service";
import { GitRunHandlers } from "./git-run";
import { GitViewState } from "./git-view-state.service";
import { gitHost, knownGitHost } from "./hosts/git-hosts";
import { classifyGitPrompt, GitPrompt } from "./model/git-process-prompt";
import { hostOf } from "./model/git-remote-url";
import {
  GitCredentialDialogComponent,
  GitCredentialDialogData,
  GitCredentialDialogResult,
} from "./ui/git-credential-dialog.component";
import { GitProcessPromptDialogComponent } from "./ui/git-process-prompt-dialog.component";

/** What one git run may ask, and whether the person refused to say. */
export type GitRunPrompts = {
  readonly handlers: GitRunHandlers;
  /** True once a credential request was dismissed; the run's failure needs no toast then. */
  readonly refused: () => boolean;
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

  /** Handlers for one run; each run gets its own, so a refusal is never charged to another. */
  forRun(): GitRunPrompts {
    let refused = false;
    return {
      handlers: {
        onPrompt: (prompt) => this.show(classifyGitPrompt(prompt.text), prompt.closed),
        onCredential: async (request) => {
          const result = await this.askCredential(request);
          if (request.closed.aborted) return null;
          if (result === "other") void this.access.open(request.origin);
          if (result === undefined || result === "other") {
            refused = true;
            return null;
          }
          return result;
        },
      },
      refused: () => refused,
    };
  }

  private askCredential(
    request: ProcessCredentialRequest,
  ): Promise<ProcessCredentialAnswer | "other" | undefined> {
    const host = hostOf(request.origin) ?? request.origin;
    // A host nobody owns outright is what the person said it is, once they did.
    const definition = knownGitHost(host) ?? gitHost(this.view.hosts()[host] ?? "other");
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
