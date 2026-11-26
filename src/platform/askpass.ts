import { Injectable } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

/**
 * A prompt from a process the command runner started: git asking for
 * credentials, ssh for a passphrase or a host key confirmation. `prompt` is
 * the text the process would have printed on a terminal; `sessionId` is the
 * prompt session the caller named when it started the command.
 */
export interface AskpassRequest {
  readonly requestId: string;
  readonly sessionId: string;
  readonly prompt: string;
}

/**
 * Git's credential helper asks for an origin nobody is signed in to. Only a
 * run that said it answers credential requests is asked.
 */
export interface CredentialRequest {
  readonly requestId: string;
  readonly sessionId: string;
  /** `https://host[:port]`, as git names it. */
  readonly origin: string;
}

export type CredentialAnswer =
  /** The person signed in in the browser; the backend hands git the token. */
  | { readonly kind: "signed_in" }
  /** Typed by hand; git gets it as it is. */
  | { readonly kind: "typed"; readonly username: string; readonly password: string };

@Injectable({ providedIn: "root" })
export class AskpassRequests {
  /** Prompts for this window; the process waits until `answer` is called. */
  onRequest(listener: (request: AskpassRequest) => void): Promise<UnlistenFn> {
    return listen<AskpassRequest>("askpass-request", ({ payload }) => listener(payload));
  }

  /** Credential requests for this window; git waits until `answerCredential` is called. */
  onCredentialRequest(listener: (request: CredentialRequest) => void): Promise<UnlistenFn> {
    return listen<CredentialRequest>("credential-request", ({ payload }) => listener(payload));
  }

  /** The process ended before its prompt or credential request was answered. */
  onClosed(listener: (requestId: string) => void): Promise<UnlistenFn> {
    return listen<{ requestId: string }>("askpass-closed", ({ payload }) =>
      listener(payload.requestId),
    );
  }

  /** `null` refuses the prompt; the process sees a failed read. */
  answer(requestId: string, answer: string | null): Promise<boolean> {
    return invoke<boolean>("askpass_answer", { requestId, answer });
  }

  /** `null` refuses the request; git fails without asking any further. */
  answerCredential(requestId: string, answer: CredentialAnswer | null): Promise<boolean> {
    return invoke<boolean>("credential_answer", { requestId, answer });
  }
}
