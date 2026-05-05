import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  LlmChatHostPortContract,
  LlmChatThreadMessageContract,
  LlmCommandSuggestionContract,
  LlmProviderStatusContract,
} from "@cogno/core-api";
import { BehaviorSubject, firstValueFrom, Observable } from "rxjs";
import { AppBus } from "../app-bus/app-bus";
import { IdCreator } from "../common/id-creator/id-creator";
import { LlmCommandExtractionService } from "./llm-command-extraction.service";
import { LlmContextSnapshotService } from "./llm-context-snapshot.service";
import {
  ChatTurnTargetTerminalReference,
  LlmChatMessage,
  LlmStreamChunk,
  TerminalContextSnapshot,
} from "./llm-host.models";
import { LlmProviderRegistryService } from "./llm-provider-registry.service";

type ThreadMessageWithProviderMessage = LlmChatThreadMessageContract & {
  readonly providerMessage?: LlmChatMessage;
};

@Injectable({ providedIn: "root" })
export class LlmChatHostPortAdapterService implements LlmChatHostPortContract {
  private static readonly RUN_COMPLETION_TIMEOUT_MS = 30_000;
  private static readonly RUN_START_TIMEOUT_MS = 1_500;
  private static readonly ABORTED_REQUEST_MESSAGE = "Request canceled.";
  private readonly threadMessagesSubject = new BehaviorSubject<
    ReadonlyArray<LlmChatThreadMessageContract>
  >([]);
  private readonly pendingSubject = new BehaviorSubject(false);
  private readonly providerStatusSubject = new BehaviorSubject<
    LlmProviderStatusContract | undefined
  >(undefined);
  private activeAbortController?: AbortController;
  private activeRequestId = 0;

  readonly threadMessages$: Observable<ReadonlyArray<LlmChatThreadMessageContract>> =
    this.threadMessagesSubject.asObservable();
  readonly pending$: Observable<boolean> = this.pendingSubject.asObservable();
  readonly providerStatus$: Observable<LlmProviderStatusContract | undefined> =
    this.providerStatusSubject.asObservable();

  constructor(
    private readonly destroyRef: DestroyRef,
    private readonly appBus: AppBus,
    private readonly llmCommandExtractionService: LlmCommandExtractionService,
    private readonly llmContextSnapshotService: LlmContextSnapshotService,
    private readonly providerRegistryService: LlmProviderRegistryService,
  ) {
    this.refreshProviderStatus();
    this.appBus
      .onType$("ConfigLoaded", { path: ["app", "settings"] })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.refreshProviderStatus();
      });
  }

  clearConversation(): void {
    this.activeRequestId++;
    this.activeAbortController?.abort();
    this.activeAbortController = undefined;
    this.pendingSubject.next(false);
    this.threadMessagesSubject.next([]);
    this.refreshProviderStatus();
  }

  async sendPrompt(prompt: string): Promise<void> {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      return;
    }

    await this.sendPromptForTerminal(trimmedPrompt);
  }

  canApplyCommandSuggestion(commandSuggestion: LlmCommandSuggestionContract): boolean {
    return this.llmContextSnapshotService.hasTerminal(commandSuggestion.targetTerminalId);
  }

  applyCommandSuggestion(commandSuggestion: LlmCommandSuggestionContract): void {
    const terminalId = commandSuggestion.targetTerminalId;
    if (!this.canApplyCommandSuggestion(commandSuggestion) || !terminalId) {
      this.appendSystemMessage("The target terminal session is no longer available.", true);
      return;
    }

    this.focusTerminal(terminalId);
    this.injectTerminalInput(terminalId, commandSuggestion.command, false);
  }

  async runCommandSuggestion(commandSuggestion: LlmCommandSuggestionContract): Promise<void> {
    const terminalId = commandSuggestion.targetTerminalId;
    if (!this.canApplyCommandSuggestion(commandSuggestion) || !terminalId) {
      this.appendSystemMessage("The target terminal session is no longer available.", true);
      return;
    }

    if (commandSuggestion.executionMode !== "run_and_continue") {
      this.focusTerminal(terminalId);
      this.injectTerminalInput(terminalId, commandSuggestion.command, true);
      this.appendSystemMessage(`Running command: ${commandSuggestion.command}`);
      return;
    }

    const executionStatePromise = this.waitForCommandExecution(terminalId);
    this.focusTerminal(terminalId);
    this.injectTerminalInput(terminalId, commandSuggestion.command, true);
    this.appendSystemMessage(`Running command and continuing: ${commandSuggestion.command}`);

    const executionState = await executionStatePromise;
    if (executionState !== "completed") {
      this.appendSystemMessage(
        "The command is still running. Ask again once more terminal output is available.",
      );
      return;
    }

    await this.sendPromptForTerminal(
      [
        "The previously suggested command was executed in the terminal.",
        `Executed command: ${commandSuggestion.command}`,
        "Review the latest terminal output and continue helping the user.",
        "If another command is needed, suggest it in a fenced shell code block.",
      ].join("\n"),
      terminalId,
      `Run and continue: ${commandSuggestion.command}`,
    );
  }

  private async sendPromptForTerminal(
    prompt: string,
    terminalId?: string,
    visiblePromptText?: string,
  ): Promise<void> {
    const resolvedProvider = this.providerRegistryService.resolveActiveProvider();
    if (!resolvedProvider) {
      this.appendSystemMessage("No usable LLM provider is configured.", true);
      this.refreshProviderStatus();
      return;
    }

    const validationErrors = this.providerRegistryService.validateActiveProvider();
    if (validationErrors.length > 0) {
      this.appendSystemMessage(validationErrors.join(" "), true);
      this.refreshProviderStatus();
      return;
    }

    this.providerStatusSubject.next({
      providerId: resolvedProvider.providerId,
      providerType: resolvedProvider.config.type,
    });

    const contextSnapshot = terminalId
      ? await this.llmContextSnapshotService.captureTerminalContext(terminalId)
      : await this.llmContextSnapshotService.captureFocusedTerminalContext();
    const target: ChatTurnTargetTerminalReference = {
      terminalId: contextSnapshot?.terminalId,
    };
    const userMessageId = IdCreator.newId("MSG");
    const assistantMessageId = IdCreator.newId("MSG");
    const providerUserMessage = this.createProviderUserMessage(prompt, contextSnapshot);
    const userThreadMessage: LlmChatThreadMessageContract & { providerMessage: LlmChatMessage } = {
      id: userMessageId,
      role: "user",
      text: visiblePromptText ?? prompt,
      providerMessage: providerUserMessage,
      targetTerminalId: target.terminalId,
    };
    const assistantThreadMessage: LlmChatThreadMessageContract & {
      providerMessage: LlmChatMessage;
    } = {
      id: assistantMessageId,
      role: "assistant",
      text: "",
      providerMessage: {
        role: "assistant",
        content: "",
      },
      targetTerminalId: target.terminalId,
      commands: [],
      isPending: true,
    };

    const requestId = ++this.activeRequestId;
    this.activeAbortController?.abort();
    const abortController = new AbortController();
    this.activeAbortController = abortController;
    this.pendingSubject.next(true);
    this.threadMessagesSubject.next([
      ...this.threadMessagesSubject.value,
      userThreadMessage,
      assistantThreadMessage,
    ]);

    try {
      const providerMessages = this.createProviderConversation();
      let assistantText = "";
      let streamCompleted = false;

      for await (const chunk of resolvedProvider.adapter.streamChat(
        resolvedProvider.providerId,
        resolvedProvider.config,
        {
          model: resolvedProvider.config.model ?? "",
          messages: providerMessages,
          abortSignal: abortController.signal,
        },
      )) {
        ({ assistantText, streamCompleted } = this.applyAssistantStreamChunk(
          assistantMessageId,
          target,
          assistantText,
          chunk,
        ));
      }

      if (!streamCompleted) {
        this.updateAssistantMessage(assistantMessageId, assistantText, target, false, false, {
          role: "assistant",
          content: assistantText,
        });
      }
    } catch (error) {
      if (this.isAbortedRequestError(error, abortController.signal)) {
        this.updateAssistantMessage(
          assistantMessageId,
          LlmChatHostPortAdapterService.ABORTED_REQUEST_MESSAGE,
          target,
          false,
          false,
          {
            role: "assistant",
            content: LlmChatHostPortAdapterService.ABORTED_REQUEST_MESSAGE,
          },
        );
        return;
      }

      const errorMessage =
        error instanceof Error ? error.message : "The configured LLM provider request failed.";
      this.updateAssistantMessage(assistantMessageId, errorMessage, target, false, true);
    } finally {
      if (this.activeRequestId === requestId) {
        this.pendingSubject.next(false);
        this.activeAbortController = undefined;
        this.refreshProviderStatus();
      }
    }
  }

  private refreshProviderStatus(): void {
    const resolvedProvider = this.providerRegistryService.resolveActiveProvider();
    this.providerStatusSubject.next(
      resolvedProvider
        ? {
            providerId: resolvedProvider.providerId,
            providerType: resolvedProvider.config.type,
          }
        : undefined,
    );
  }

  private createSystemMessage(): LlmChatMessage {
    return {
      role: "system",
      content: [
        "You are an assistant inside a terminal workspace application.",
        "Use the provided terminal context to answer precisely.",
        "If you suggest runnable commands, put each command in its own fenced code block with a shell language tag such as ```sh or ```powershell.",
        "If you need terminal output before you can continue helping, add llm:continue to the fenced code block header, for example ```sh llm:continue.",
        "Blocks without llm:continue are treated as run_only.",
        "Use llm:continue for inspection, discovery, diagnostics, and fact gathering commands.",
        "Do not use llm:continue for final solution commands, install commands, or commands that already fully answer the request.",
        "Everything runnable must appear directly in the visible fenced code block text.",
        "Keep explanations concise and practical.",
      ].join(" "),
    };
  }

  private createProviderConversation(): LlmChatMessage[] {
    return [
      this.createSystemMessage(),
      ...this.threadMessagesSubject.value.flatMap((message) => {
        const threadMessage = message as ThreadMessageWithProviderMessage;
        return !threadMessage.isPending && threadMessage.providerMessage
          ? [threadMessage.providerMessage]
          : [];
      }),
    ];
  }

  private createProviderUserMessage(
    prompt: string,
    contextSnapshot: TerminalContextSnapshot | undefined,
  ): LlmChatMessage {
    const contextPayload = contextSnapshot
      ? JSON.stringify(contextSnapshot, null, 2)
      : JSON.stringify({ terminal: null }, null, 2);

    return {
      role: "user",
      content: [
        "Terminal context:",
        "```json",
        contextPayload,
        "```",
        "",
        "User request:",
        prompt,
      ].join("\n"),
    };
  }

  private updateAssistantMessage(
    messageId: string,
    text: string,
    target: ChatTurnTargetTerminalReference,
    isPending: boolean,
    isError = false,
    providerMessage?: LlmChatMessage,
  ): void {
    const parsedAssistantResponse = this.llmCommandExtractionService.parseAssistantResponse(
      messageId,
      text,
      target,
    );
    const commands = parsedAssistantResponse.commands.map((commandSuggestion) => ({
      command: commandSuggestion.command,
      language: commandSuggestion.language,
      executionMode: commandSuggestion.executionMode,
      sourceMessageId: commandSuggestion.sourceMessageId,
      targetTerminalId: commandSuggestion.target.terminalId,
    }));
    this.threadMessagesSubject.next(
      this.threadMessagesSubject.value.map((message) =>
        message.id === messageId
          ? {
              ...message,
              text: parsedAssistantResponse.displayText,
              providerMessage:
                providerMessage ?? (message as ThreadMessageWithProviderMessage).providerMessage,
              commands,
              isPending,
              isError,
            }
          : message,
      ),
    );
  }

  private applyAssistantStreamChunk(
    messageId: string,
    target: ChatTurnTargetTerminalReference,
    currentText: string,
    chunk: LlmStreamChunk,
  ): { assistantText: string; streamCompleted: boolean } {
    const assistantText = currentText + chunk.text;
    this.updateAssistantMessage(messageId, assistantText, target, !chunk.done, false, {
      role: "assistant",
      content: assistantText,
    });
    return {
      assistantText,
      streamCompleted: !!chunk.done,
    };
  }

  private appendSystemMessage(text: string, isError = false): void {
    this.threadMessagesSubject.next([
      ...this.threadMessagesSubject.value,
      {
        id: IdCreator.newId("MSG"),
        role: "system",
        text,
        targetTerminalId: undefined,
        isError,
      },
    ]);
  }

  private focusTerminal(terminalId: string): void {
    this.appBus.publish({
      path: ["app", "terminal"],
      type: "FocusTerminal",
      payload: terminalId,
    });
  }

  private injectTerminalInput(terminalId: string, text: string, appendNewline: boolean): void {
    this.appBus.publish({
      path: ["app", "terminal"],
      type: "InjectTerminalInput",
      payload: {
        terminalId,
        text,
        appendNewline,
      },
    });
  }

  private async waitForCommandExecution(terminalId: string): Promise<"completed" | "timeout"> {
    const startedPromise = firstValueFrom(
      this.appBus.once$({
        path: ["app", "terminal"],
        type: "TerminalBusyChanged",
        predicate: (event) =>
          event.payload?.terminalId === terminalId && event.payload.isBusy === true,
        timeoutMs: LlmChatHostPortAdapterService.RUN_START_TIMEOUT_MS,
      }),
    )
      .then(() => true)
      .catch(() => false);
    const completedPromise = firstValueFrom(
      this.appBus.once$({
        path: ["app", "terminal"],
        type: "TerminalBusyChanged",
        predicate: (event) =>
          event.payload?.terminalId === terminalId && event.payload.isBusy === false,
        timeoutMs: LlmChatHostPortAdapterService.RUN_COMPLETION_TIMEOUT_MS,
      }),
    )
      .then(() => true)
      .catch(() => false);

    await startedPromise;
    return (await completedPromise) ? "completed" : "timeout";
  }

  private isAbortedRequestError(error: unknown, abortSignal: AbortSignal): boolean {
    return Boolean(
      abortSignal.aborted &&
        error instanceof Error &&
        (error.name === "AbortError" || error.message === "This operation was aborted"),
    );
  }
}
