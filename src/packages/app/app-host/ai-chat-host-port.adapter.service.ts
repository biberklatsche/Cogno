import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  AiChatHostPortContract,
  AiChatThreadMessageContract,
  AiCommandSuggestionContract,
  AiProviderStatusContract,
} from "@cogno/core-api";
import { BehaviorSubject, firstValueFrom, Observable } from "rxjs";
import { AppBus } from "../app-bus/app-bus";
import { IdCreator } from "../common/id-creator/id-creator";
import { AiCommandExtractionService } from "./ai-command-extraction.service";
import { AiContextSnapshotService } from "./ai-context-snapshot.service";
import {
  AiChatMessage,
  AiStreamChunk,
  ChatTurnTargetTerminalReference,
  TerminalContextSnapshot,
} from "./ai-host.models";
import { AiProviderRegistryService } from "./ai-provider-registry.service";

type ThreadMessageWithProviderMessage = AiChatThreadMessageContract & {
  readonly providerMessage?: AiChatMessage;
};

@Injectable({ providedIn: "root" })
export class AiChatHostPortAdapterService implements AiChatHostPortContract {
  private static readonly RUN_COMPLETION_TIMEOUT_MS = 30_000;
  private static readonly RUN_START_TIMEOUT_MS = 1_500;
  private static readonly ABORTED_REQUEST_MESSAGE = "Request canceled.";
  private readonly threadMessagesSubject = new BehaviorSubject<
    ReadonlyArray<AiChatThreadMessageContract>
  >([]);
  private readonly pendingSubject = new BehaviorSubject(false);
  private readonly focusedTerminalIdSubject = new BehaviorSubject<string | undefined>(undefined);
  private readonly providerStatusesSubject = new BehaviorSubject<
    ReadonlyArray<AiProviderStatusContract>
  >([]);
  private readonly providerStatusSubject = new BehaviorSubject<
    AiProviderStatusContract | undefined
  >(undefined);
  private activeAbortController?: AbortController;
  private activeRequestId = 0;

  readonly threadMessages$: Observable<ReadonlyArray<AiChatThreadMessageContract>> =
    this.threadMessagesSubject.asObservable();
  readonly pending$: Observable<boolean> = this.pendingSubject.asObservable();
  readonly focusedTerminalId$: Observable<string | undefined> =
    this.focusedTerminalIdSubject.asObservable();
  readonly providerStatuses$: Observable<ReadonlyArray<AiProviderStatusContract>> =
    this.providerStatusesSubject.asObservable();
  readonly providerStatus$: Observable<AiProviderStatusContract | undefined> =
    this.providerStatusSubject.asObservable();

  constructor(
    private readonly destroyRef: DestroyRef,
    private readonly appBus: AppBus,
    private readonly aiCommandExtractionService: AiCommandExtractionService,
    private readonly aiContextSnapshotService: AiContextSnapshotService,
    private readonly providerRegistryService: AiProviderRegistryService,
  ) {
    this.focusedTerminalIdSubject.next(this.aiContextSnapshotService.getFocusedTerminalId());
    this.refreshProviderStatus();
    this.appBus
      .onType$("ConfigLoaded", { path: ["app", "settings"] })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.refreshProviderStatus();
      });
    this.appBus
      .onType$("FocusTerminal", { path: ["app", "terminal"] })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.focusedTerminalIdSubject.next(event.payload);
      });
    this.appBus
      .onType$("TerminalRemoved", { path: ["app", "terminal"] })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (event.payload && event.payload === this.focusedTerminalIdSubject.value) {
          this.focusedTerminalIdSubject.next(undefined);
        }
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

  async selectProvider(providerId: string): Promise<void> {
    await this.providerRegistryService.selectActiveProvider(providerId);
    this.refreshProviderStatus();
  }

  canApplyCommandSuggestion(commandSuggestion: AiCommandSuggestionContract): boolean {
    const executionTerminalId = this.resolveExecutionTerminalId(commandSuggestion);
    return !!executionTerminalId && this.aiContextSnapshotService.hasTerminal(executionTerminalId);
  }

  applyCommandSuggestion(commandSuggestion: AiCommandSuggestionContract): void {
    const terminalId = this.resolveExecutionTerminalId(commandSuggestion);
    if (!terminalId || !this.aiContextSnapshotService.hasTerminal(terminalId)) {
      this.appendSystemMessage("No active terminal session is available.", true);
      return;
    }

    this.focusTerminal(terminalId);
    this.injectTerminalInput(terminalId, commandSuggestion.command, false);
  }

  openCommandSuggestionTerminal(commandSuggestion: AiCommandSuggestionContract): void {
    const terminalId = commandSuggestion.targetTerminalId;
    if (!terminalId || !this.aiContextSnapshotService.hasTerminal(terminalId)) {
      return;
    }

    this.focusTerminal(terminalId);
  }

  async runCommandSuggestion(commandSuggestion: AiCommandSuggestionContract): Promise<void> {
    const terminalId = this.resolveExecutionTerminalId(commandSuggestion);
    if (!terminalId || !this.aiContextSnapshotService.hasTerminal(terminalId)) {
      this.appendSystemMessage("No active terminal session is available.", true);
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
      this.appendSystemMessage("No usable AI provider is configured.", true);
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
      providerModel: resolvedProvider.config.model || "",
    });

    const contextSnapshot = terminalId
      ? await this.aiContextSnapshotService.captureTerminalContext(terminalId)
      : await this.aiContextSnapshotService.captureFocusedTerminalContext();
    const target: ChatTurnTargetTerminalReference = {
      terminalId: contextSnapshot?.terminalId,
    };
    const userMessageId = IdCreator.newId("MSG");
    const assistantMessageId = IdCreator.newId("MSG");
    const providerUserMessage = this.createProviderUserMessage(prompt, contextSnapshot);
    const userThreadMessage: AiChatThreadMessageContract & { providerMessage: AiChatMessage } = {
      id: userMessageId,
      role: "user",
      text: visiblePromptText ?? prompt,
      providerMessage: providerUserMessage,
      targetTerminalId: target.terminalId,
    };
    const assistantThreadMessage: AiChatThreadMessageContract & {
      providerMessage: AiChatMessage;
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
          AiChatHostPortAdapterService.ABORTED_REQUEST_MESSAGE,
          target,
          false,
          false,
          {
            role: "assistant",
            content: AiChatHostPortAdapterService.ABORTED_REQUEST_MESSAGE,
          },
        );
        return;
      }

      const errorMessage =
        error instanceof Error ? error.message : "The configured AI provider request failed.";
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
    this.providerStatusesSubject.next(this.providerRegistryService.listEnabledProviderStatuses());
    const resolvedProvider = this.providerRegistryService.resolveActiveProvider();
    this.providerStatusSubject.next(
      resolvedProvider
        ? {
            providerId: resolvedProvider.providerId,
            providerType: resolvedProvider.config.type,
            providerModel: resolvedProvider.config.model || "",
          }
        : undefined,
    );
  }

  private createSystemMessage(): AiChatMessage {
    return {
      role: "system",
      content: [
        "You are an assistant inside a terminal workspace application.",
        "Use the provided terminal context to answer precisely.",
        "If you suggest runnable commands, put each command in its own fenced code block with a shell language tag such as ```sh or ```powershell.",
        "If you need terminal output before you can continue helping, add ai:continue to the fenced code block header, for example ```sh ai:continue.",
        "Blocks without ai:continue are treated as run_only.",
        "Use ai:continue for inspection, discovery, diagnostics, and fact gathering commands.",
        "Do not use ai:continue for final solution commands, install commands, or commands that already fully answer the request.",
        "Everything runnable must appear directly in the visible fenced code block text.",
        "Keep explanations concise and practical.",
      ].join(" "),
    };
  }

  private createProviderConversation(): AiChatMessage[] {
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
  ): AiChatMessage {
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
    providerMessage?: AiChatMessage,
  ): void {
    const parsedAssistantResponse = this.aiCommandExtractionService.parseAssistantResponse(
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
    chunk: AiStreamChunk,
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

  private resolveExecutionTerminalId(
    commandSuggestion: AiCommandSuggestionContract,
  ): string | undefined {
    return this.focusedTerminalIdSubject.value ?? commandSuggestion.targetTerminalId;
  }

  private async waitForCommandExecution(terminalId: string): Promise<"completed" | "timeout"> {
    const startedPromise = firstValueFrom(
      this.appBus.once$({
        path: ["app", "terminal"],
        type: "TerminalBusyChanged",
        predicate: (event) =>
          event.payload?.terminalId === terminalId && event.payload.isBusy === true,
        timeoutMs: AiChatHostPortAdapterService.RUN_START_TIMEOUT_MS,
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
        timeoutMs: AiChatHostPortAdapterService.RUN_COMPLETION_TIMEOUT_MS,
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
