import { DestroyRef, Injectable } from "@angular/core";
import {
  CommandRunner as CommandRunnerPort,
  CommandRunnerRequestContract,
  CommandRunnerResultContract,
  ProcessAnswers,
} from "@cogno/core/api/command-runner-port";
import { CommandRunner } from "@cogno/platform/command-runner";
import { RunQuestion, RunQuestionKind, RunQuestions } from "@cogno/platform/run-questions";
import { createPathAdapter } from "../shells/shell-definitions";

/** The answer the backend gets for a question; `null` refuses it. */
type Answer = Parameters<RunQuestions["answer"]>[1];

/**
 * Runs commands in the backend and hands each question a process raises (an
 * ssh passphrase, a host key, git's credential request - ARCHITECTURE.md 2.1)
 * to whoever answers for the run that caused it. A run says at its start
 * which kinds of question it answers; no other kind reaches the window.
 */
@Injectable({ providedIn: "root" })
export class CommandRunnerHostService extends CommandRunnerPort {
  /** Prompt session of a running command -> who answers its questions. */
  private readonly answers = new Map<string, ProcessAnswers>();
  /** Open questions, so the process ending can close them. */
  private readonly open = new Map<string, AbortController>();

  constructor(
    private readonly commandRunner: CommandRunner,
    private readonly questions: RunQuestions,
    destroyRef: DestroyRef,
  ) {
    super();
    void questions
      .onQuestion((question) => void this.relay(question))
      .then((unlisten) => destroyRef.onDestroy(unlisten));
    void questions
      .onClosed((requestId) => this.open.get(requestId)?.abort())
      .then((unlisten) => destroyRef.onDestroy(unlisten));
  }

  async run(request: CommandRunnerRequestContract): Promise<CommandRunnerResultContract> {
    const promptSession = crypto.randomUUID();
    const answers = request.answers ?? {};
    this.answers.set(promptSession, answers);
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
        answeredKinds(answers),
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
      this.answers.delete(promptSession);
    }
  }

  /**
   * Lets the run answer one question and tells the process. A run that is
   * over, or an answer that throws, means no answer. If the process ended
   * first, the signal fires and nothing is sent.
   */
  private async relay(question: RunQuestion): Promise<void> {
    const answers = this.answers.get(question.sessionId);
    const closed = new AbortController();
    this.open.set(question.requestId, closed);
    let answer: Answer = null;
    try {
      answer = answers ? await ask(answers, question, closed.signal) : null;
    } catch {
      answer = null;
    } finally {
      this.open.delete(question.requestId);
    }
    if (!closed.signal.aborted) await this.questions.answer(question.requestId, answer);
  }
}

/** The kinds of question a run has somebody for. */
function answeredKinds(answers: ProcessAnswers): RunQuestionKind[] {
  const kinds: RunQuestionKind[] = [];
  if (answers.prompt) kinds.push("prompt");
  if (answers.credential) kinds.push("credential");
  if (answers.credentialRejected) kinds.push("credential_rejected");
  return kinds;
}

/** Puts a question to the part of the run that answers its kind. */
async function ask(
  answers: ProcessAnswers,
  question: RunQuestion,
  closed: AbortSignal,
): Promise<Answer> {
  switch (question.kind) {
    case "prompt":
      return (await answers.prompt?.({ text: question.payload.text, closed })) ?? null;
    case "credential":
      return (await answers.credential?.({ origin: question.payload.origin, closed })) ?? null;
    case "credential_rejected":
      answers.credentialRejected?.(question.payload.origin);
      return true;
  }
}
