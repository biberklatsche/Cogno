import { DestroyRef, Injectable } from "@angular/core";
import {
  CommandRunner as CommandRunnerPort,
  CommandRunnerRequestContract,
  CommandRunnerResultContract,
  ProcessPromptHandler,
} from "@cogno/core/api/command-runner-port";
import { AskpassRequest, AskpassRequests } from "@cogno/platform/askpass";
import { CommandRunner } from "@cogno/platform/command-runner";
import { createPathAdapter } from "../shells/shell-definitions";

/**
 * Runs commands in the backend and hands each prompt a process raises (git
 * credentials, an ssh passphrase, a host key - ARCHITECTURE.md 2.1) to the
 * handler of the run that caused it. A run without a handler refuses its
 * prompts: the process sees a failed read instead of a dialog nobody asked for.
 */
@Injectable({ providedIn: "root" })
export class CommandRunnerHostService extends CommandRunnerPort {
  /** Prompt session of a running command -> its handler. */
  private readonly handlers = new Map<string, ProcessPromptHandler>();
  /** Open prompts, so the process ending can close them. */
  private readonly open = new Map<string, AbortController>();

  constructor(
    private readonly commandRunner: CommandRunner,
    private readonly askpass: AskpassRequests,
    destroyRef: DestroyRef,
  ) {
    super();
    void askpass
      .onRequest((request) => void this.answer(request))
      .then((unlisten) => destroyRef.onDestroy(unlisten));
    void askpass
      .onClosed((requestId) => this.open.get(requestId)?.abort())
      .then((unlisten) => destroyRef.onDestroy(unlisten));
  }

  async run(request: CommandRunnerRequestContract): Promise<CommandRunnerResultContract> {
    const promptSession = crypto.randomUUID();
    if (request.onPrompt) this.handlers.set(promptSession, request.onPrompt);
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
    }
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
