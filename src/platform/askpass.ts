import { Injectable } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

/**
 * A prompt from a process the command runner started: git asking for
 * credentials, ssh for a passphrase or a host key confirmation. `prompt` is
 * the text the process would have printed on a terminal.
 */
export interface AskpassRequest {
  readonly requestId: string;
  readonly prompt: string;
}

@Injectable({ providedIn: "root" })
export class AskpassRequests {
  /** Prompts for this window; the process waits until `answer` is called. */
  onRequest(listener: (request: AskpassRequest) => void): Promise<UnlistenFn> {
    return listen<AskpassRequest>("askpass-request", ({ payload }) => listener(payload));
  }

  /** The process ended before its prompt was answered. */
  onClosed(listener: (requestId: string) => void): Promise<UnlistenFn> {
    return listen<{ requestId: string }>("askpass-closed", ({ payload }) =>
      listener(payload.requestId),
    );
  }

  /** `null` refuses the prompt; the process sees a failed read. */
  answer(requestId: string, answer: string | null): Promise<boolean> {
    return invoke<boolean>("askpass_answer", { requestId, answer });
  }
}
