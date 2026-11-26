import { Injectable } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

/**
 * What a process the command runner started asks the window that started it
 * (ARCHITECTURE.md 2.1). It has no terminal, so its questions come through
 * the backend, each tagged with the prompt session the caller named when it
 * started the command:
 *
 * - `prompt`: the text ssh would have printed on a terminal - a passphrase, a
 *   host key. The answer is what the person types.
 * - `credential`: git needs credentials for an origin (`https://host[:port]`)
 *   nobody is signed in to. The answer is a `CredentialAnswer`.
 * - `credential_rejected`: git reported the credential it used for an origin
 *   as rejected. Nothing to answer but that it was heard.
 */
export type RunQuestion = {
  readonly requestId: string;
  readonly sessionId: string;
} & (
  | { readonly kind: "prompt"; readonly payload: { readonly text: string } }
  | { readonly kind: "credential"; readonly payload: { readonly origin: string } }
  | { readonly kind: "credential_rejected"; readonly payload: { readonly origin: string } }
);

export type RunQuestionKind = RunQuestion["kind"];

export type CredentialAnswer =
  /** The person signed in in the browser; the backend hands git the token. */
  | { readonly kind: "signed_in" }
  /** Typed by hand; git gets it as it is. */
  | { readonly kind: "typed"; readonly username: string; readonly password: string };

@Injectable({ providedIn: "root" })
export class RunQuestions {
  /**
   * Questions for this window; the process waits until `answer` is called.
   * Only kinds the run said it answers arrive.
   */
  onQuestion(listener: (question: RunQuestion) => void): Promise<UnlistenFn> {
    return listen<RunQuestion>("run-question", ({ payload }) => listener(payload));
  }

  /** The process ended before its question was answered. */
  onClosed(listener: (requestId: string) => void): Promise<UnlistenFn> {
    return listen<{ requestId: string }>("run-question-closed", ({ payload }) =>
      listener(payload.requestId),
    );
  }

  /** `null` refuses the question: a prompt sees a failed read, git stops asking for credentials. */
  answer(requestId: string, answer: string | CredentialAnswer | true | null): Promise<boolean> {
    return invoke<boolean>("run_question_answer", { requestId, answer });
  }
}
