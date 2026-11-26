import { DestroyRef, Injectable } from "@angular/core";
import {
  CommandRunner as CommandRunnerPort,
  CommandRunnerRequestContract,
  CommandRunnerResultContract,
  ProcessCredentialHandler,
  ProcessPromptHandler,
} from "@cogno/core/api/command-runner-port";
import { AskpassRequests, CredentialAnswer } from "@cogno/platform/askpass";
import { CommandRunner } from "@cogno/platform/command-runner";
import { createPathAdapter } from "../shells/shell-definitions";

/**
 * Runs commands in the backend and hands each prompt a process raises (an
 * ssh passphrase, a host key - ARCHITECTURE.md 2.1) and each credential
 * request of git to the handler of the run that caused it. A run without a
 * prompt handler refuses its prompts: the process sees a failed read instead
 * of a dialog nobody asked for. A run without a credential handler says so
 * when it starts, and git goes on to its own prompt.
 */
@Injectable({ providedIn: "root" })
export class CommandRunnerHostService extends CommandRunnerPort {
  /** Prompt session of a running command -> its handler. */
  private readonly handlers = new Map<string, ProcessPromptHandler>();
  /** Prompt session of a running command -> who answers its credential requests. */
  private readonly credentialHandlers = new Map<string, ProcessCredentialHandler>();
  /** Open prompts and credential requests, so the process ending can close them. */
  private readonly open = new Map<string, AbortController>();

  constructor(
    private readonly commandRunner: CommandRunner,
    askpass: AskpassRequests,
    destroyRef: DestroyRef,
  ) {
    super();
    void askpass
      .onRequest((request) => {
        const handler = this.handlers.get(request.sessionId);
        void this.relay<string>(
          request.requestId,
          handler && ((closed) => handler({ text: request.prompt, closed })),
          (answer) => askpass.answer(request.requestId, answer),
        );
      })
      .then((unlisten) => destroyRef.onDestroy(unlisten));
    void askpass
      .onCredentialRequest((request) => {
        const handler = this.credentialHandlers.get(request.sessionId);
        void this.relay<CredentialAnswer>(
          request.requestId,
          handler && ((closed) => handler({ origin: request.origin, closed })),
          (answer) => askpass.answerCredential(request.requestId, answer),
        );
      })
      .then((unlisten) => destroyRef.onDestroy(unlisten));
    void askpass
      .onClosed((requestId) => this.open.get(requestId)?.abort())
      .then((unlisten) => destroyRef.onDestroy(unlisten));
  }

  async run(request: CommandRunnerRequestContract): Promise<CommandRunnerResultContract> {
    const promptSession = crypto.randomUUID();
    if (request.onPrompt) this.handlers.set(promptSession, request.onPrompt);
    if (request.onCredential) this.credentialHandlers.set(promptSession, request.onCredential);
    try {
      const adapter = createPathAdapter(request.shellContext);
      const normalizedCwd = adapter.normalize(request.cwd);
      const backendPath = adapter.render(normalizedCwd, { purpose: "backend_fs" });
      if (!backendPath) {
        return { stdout: "", stderr: "", exitCode: 1 };
      }

      return await this.commandRunner.execute(
        request.program,
        request.args ?? [],
        backendPath,
        promptSession,
        request.onCredential !== undefined,
        request.timeoutMs,
        request.stdin,
      );
    } catch (error) {
      return {
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: 1,
      };
    } finally {
      this.handlers.delete(promptSession);
      this.credentialHandlers.delete(promptSession);
    }
  }

  /**
   * Lets the run's handler answer one question and tells the process. No
   * handler, or one that throws, means no answer. If the process ended first,
   * the handler's signal fires and nothing is sent.
   */
  private async relay<T>(
    requestId: string,
    ask: ((closed: AbortSignal) => Promise<T | null>) | undefined,
    reply: (answer: T | null) => Promise<boolean>,
  ): Promise<void> {
    if (!ask) {
      await reply(null);
      return;
    }
    const closed = new AbortController();
    this.open.set(requestId, closed);
    let answer: T | null = null;
    try {
      answer = await ask(closed.signal);
    } catch {
      answer = null;
    } finally {
      this.open.delete(requestId);
    }
    if (!closed.signal.aborted) await reply(answer);
  }
}
