import { DestroyRef, Injectable } from "@angular/core";
import { ProcessPromptHandler } from "@cogno/core/api/command-runner-port";
import { AskpassRequest, AskpassRequests } from "@cogno/platform/askpass";

/**
 * Hands each prompt a process without a terminal raises (git credentials, an
 * ssh passphrase, a host key - ARCHITECTURE.md 2.1) to whoever started that
 * process. The starter registers a handler under the prompt session it names
 * to the backend; a prompt of a session nobody registered is refused, so the
 * process sees a failed read instead of a dialog nobody asked for.
 */
@Injectable({ providedIn: "root" })
export class ProcessPromptDispatcher {
  /** Prompt session of a running process -> its handler. */
  private readonly handlers = new Map<string, ProcessPromptHandler>();
  /** Open prompts, so the process ending can close them. */
  private readonly open = new Map<string, AbortController>();

  constructor(
    private readonly askpass: AskpassRequests,
    destroyRef: DestroyRef,
  ) {
    void askpass
      .onRequest((request) => void this.answer(request))
      .then((unlisten) => destroyRef.onDestroy(unlisten));
    void askpass
      .onClosed((requestId) => this.open.get(requestId)?.abort())
      .then((unlisten) => destroyRef.onDestroy(unlisten));
  }

  /**
   * Answers the prompts of `promptSession` with `handler` until the returned
   * function is called: when the process has ended.
   */
  register(promptSession: string, handler: ProcessPromptHandler): () => void {
    this.handlers.set(promptSession, handler);
    return () => this.handlers.delete(promptSession);
  }

  private async answer(request: AskpassRequest): Promise<void> {
    const handler = this.handlers.get(request.sessionId);
    if (!handler) {
      await this.askpass.answer(request.requestId, null);
      return;
    }
    const closed = new AbortController();
    this.open.set(request.requestId, closed);
    let answer: string | null = null;
    try {
      answer = await handler({ text: request.prompt, closed: closed.signal });
    } catch {
      answer = null;
    } finally {
      this.open.delete(request.requestId);
    }
    if (!closed.signal.aborted) await this.askpass.answer(request.requestId, answer);
  }
}
