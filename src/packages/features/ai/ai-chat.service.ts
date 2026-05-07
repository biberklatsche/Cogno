import { computed, DestroyRef, Injectable, Signal, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  ApplicationConfigurationPort,
  TerminalGateway,
  TerminalSnapshotContract,
  TerminalSnapshotOptionsContract,
} from "@cogno/core-api";
import { filter, firstValueFrom, map, timeout } from "rxjs";
import {
  AiChatMessage,
  AiChatThreadMessage,
  AiCommandSuggestion,
  AiProviderStatus,
  ChatTurnTargetTerminalReference,
} from "./ai.models";
import { AiCommandExtractionService } from "./ai-command-extraction.service";
import { getAiFeatureConfig } from "./ai-config.utils";
import { AiProviderRegistryService } from "./ai-provider-registry.service";

type ThreadMessageWithProviderMessage = AiChatThreadMessage & {
  readonly providerMessage?: AiChatMessage;
};

@Injectable({ providedIn: "root" })
export class AiChatService {
  private static readonly RUN_COMPLETION_TIMEOUT_MS = 30_000;
  private static readonly RUN_START_TIMEOUT_MS = 1_500;
  private static readonly ABORTED_REQUEST_MESSAGE = "Request canceled.";
  private readonly threadMessagesSignal = signal<ReadonlyArray<AiChatThreadMessage>>([]);
  private readonly pendingSignal = signal(false);
  private readonly providerStatusSignal = signal<AiProviderStatus | undefined>(undefined);
  private readonly providerStatusesSignal = signal<ReadonlyArray<AiProviderStatus>>([]);
  private readonly focusedTerminalIdSignal = signal<string | undefined>(undefined);
  private readonly composerTextSignal = signal("");
  private activeAbortController?: AbortController;
  private activeRequestId = 0;

  readonly threadMessages = this.threadMessagesSignal.asReadonly();
  readonly pending = this.pendingSignal.asReadonly();
  readonly providerStatus = this.providerStatusSignal.asReadonly();
  readonly providerStatuses = this.providerStatusesSignal.asReadonly();
  readonly focusedTerminalId = this.focusedTerminalIdSignal.asReadonly();
  readonly composerText: Signal<string> = this.composerTextSignal.asReadonly();
  readonly canSend: Signal<boolean>;

  constructor(
    private readonly applicationConfigurationPort: ApplicationConfigurationPort,
    private readonly terminalGateway: TerminalGateway,
    private readonly aiCommandExtractionService: AiCommandExtractionService,
    private readonly providerRegistryService: AiProviderRegistryService,
    destroyRef: DestroyRef,
  ) {
    this.focusedTerminalIdSignal.set(this.terminalGateway.getFocusedTerminalId());
    this.refreshProviderStatus();
    this.applicationConfigurationPort.configuration$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(() => {
        this.refreshProviderStatus();
      });
    this.terminalGateway.focusedTerminalId$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((terminalId) => {
        this.focusedTerminalIdSignal.set(terminalId);
      });
    this.canSend = computed(
      () => !this.pending() && this.composerText().trim().length > 0 && !!this.providerStatus(),
    );
  }

  updateComposerText(text: string): void {
    this.composerTextSignal.set(text);
  }

  async sendCurrentPrompt(): Promise<void> {
    const prompt = this.composerTextSignal().trim();
    if (!prompt) {
      return;
    }

    this.composerTextSignal.set("");
    try {
      await this.sendPrompt(prompt);
    } catch (error) {
      if (!this.composerTextSignal()) {
        this.composerTextSignal.set(prompt);
      }
      throw error;
    }
  }

  clearConversation(): void {
    this.activeRequestId++;
    this.activeAbortController?.abort();
    this.activeAbortController = undefined;
    this.pendingSignal.set(false);
    this.threadMessagesSignal.set([]);
    this.refreshProviderStatus();
  }

  async selectProvider(providerId: string): Promise<void> {
    await this.providerRegistryService.selectActiveProvider(providerId);
    this.refreshProviderStatus();
  }

  canApplyCommandSuggestion(commandSuggestion: AiCommandSuggestion): boolean {
    const executionTerminalId = this.resolveExecutionTerminalId(commandSuggestion);
    return !!executionTerminalId && this.terminalGateway.hasTerminal(executionTerminalId);
  }

  applyCommandSuggestion(commandSuggestion: AiCommandSuggestion): void {
    const terminalId = this.resolveExecutionTerminalId(commandSuggestion);
    if (!terminalId || !this.terminalGateway.hasTerminal(terminalId)) {
      this.appendSystemMessage("No active terminal session is available.", true);
      return;
    }

    this.terminalGateway.focusTerminal(terminalId);
    this.terminalGateway.injectInput({
      terminalId,
      text: commandSuggestion.command,
      appendNewline: false,
    });
  }

  openCommandSuggestionTerminal(commandSuggestion: AiCommandSuggestion): void {
    const terminalId = commandSuggestion.targetTerminalId;
    if (!terminalId || !this.terminalGateway.hasTerminal(terminalId)) {
      return;
    }

    this.terminalGateway.focusTerminal(terminalId);
  }

  async runCommandSuggestion(commandSuggestion: AiCommandSuggestion): Promise<void> {
    const terminalId = this.resolveExecutionTerminalId(commandSuggestion);
    if (!terminalId || !this.terminalGateway.hasTerminal(terminalId)) {
      this.appendSystemMessage("No active terminal session is available.", true);
      return;
    }

    if (commandSuggestion.executionMode !== "run_and_continue") {
      this.terminalGateway.focusTerminal(terminalId);
      this.terminalGateway.injectInput({
        terminalId,
        text: commandSuggestion.command,
        appendNewline: true,
      });
      this.appendSystemMessage(`Running command: ${commandSuggestion.command}`);
      return;
    }

    const executionStatePromise = this.waitForCommandExecution(terminalId);
    this.terminalGateway.focusTerminal(terminalId);
    this.terminalGateway.injectInput({
      terminalId,
      text: commandSuggestion.command,
      appendNewline: true,
    });
    this.appendSystemMessage(`Running command and continuing: ${commandSuggestion.command}`);

    const executionState = await executionStatePromise;
    if (executionState !== "completed") {
      this.appendSystemMessage(
        "The command is still running. Ask again once more terminal output is available.",
      );
      return;
    }

    await this.sendPrompt(
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

  getStatusMessage(): string | undefined {
    return this.formatStatusMessage(this.providerStatus());
  }

  formatStatusMessage(providerStatus: AiProviderStatus | undefined): string | undefined {
    return providerStatus
      ? `${providerStatus.providerId} (${providerStatus.providerModel})`
      : undefined;
  }

  private async sendPrompt(
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

    this.providerStatusSignal.set({
      providerId: resolvedProvider.providerId,
      providerType: resolvedProvider.config.type,
      providerModel: resolvedProvider.config.model || "",
    });

    const snapshotOptions = this.resolveSnapshotOptions();
    const contextSnapshot = terminalId
      ? await this.terminalGateway.captureSnapshot(terminalId, snapshotOptions)
      : await this.terminalGateway.captureFocusedSnapshot(snapshotOptions);
    const target: ChatTurnTargetTerminalReference = {
      terminalId: contextSnapshot?.terminalId,
    };
    const userMessageId = newMessageId();
    const assistantMessageId = newMessageId();
    const providerUserMessage = this.createProviderUserMessage(prompt, contextSnapshot);
    const userThreadMessage: ThreadMessageWithProviderMessage = {
      id: userMessageId,
      role: "user",
      text: visiblePromptText ?? prompt,
      providerMessage: providerUserMessage,
      targetTerminalId: target.terminalId,
    };
    const assistantThreadMessage: ThreadMessageWithProviderMessage = {
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
    this.pendingSignal.set(true);
    this.threadMessagesSignal.set([
      ...this.threadMessagesSignal(),
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
          AiChatService.ABORTED_REQUEST_MESSAGE,
          target,
          false,
          false,
          {
            role: "assistant",
            content: AiChatService.ABORTED_REQUEST_MESSAGE,
          },
        );
        return;
      }

      const errorMessage =
        error instanceof Error ? error.message : "The configured AI provider request failed.";
      this.updateAssistantMessage(assistantMessageId, errorMessage, target, false, true);
    } finally {
      if (this.activeRequestId === requestId) {
        this.pendingSignal.set(false);
        this.activeAbortController = undefined;
        this.refreshProviderStatus();
      }
    }
  }

  private refreshProviderStatus(): void {
    this.providerStatusesSignal.set(this.providerRegistryService.listEnabledProviderStatuses());
    const resolvedProvider = this.providerRegistryService.resolveActiveProvider();
    this.providerStatusSignal.set(
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
      ...this.threadMessagesSignal().flatMap((message) => {
        const threadMessage = message as ThreadMessageWithProviderMessage;
        return !threadMessage.isPending && threadMessage.providerMessage
          ? [threadMessage.providerMessage]
          : [];
      }),
    ];
  }

  private createProviderUserMessage(
    prompt: string,
    contextSnapshot: TerminalSnapshotContract | undefined,
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
    this.threadMessagesSignal.set(
      this.threadMessagesSignal().map((message) =>
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
    chunk: { readonly text: string; readonly done?: boolean },
  ): { assistantText: string; streamCompleted: boolean } {
    const assistantText = currentText + chunk.text;
    const isPending = !chunk.done && assistantText.length === 0;
    this.updateAssistantMessage(messageId, assistantText, target, isPending, false, {
      role: "assistant",
      content: assistantText,
    });
    return {
      assistantText,
      streamCompleted: !!chunk.done,
    };
  }

  private appendSystemMessage(text: string, isError = false): void {
    this.threadMessagesSignal.set([
      ...this.threadMessagesSignal(),
      {
        id: newMessageId(),
        role: "system",
        text,
        targetTerminalId: undefined,
        isError,
      },
    ]);
  }

  private resolveExecutionTerminalId(commandSuggestion: AiCommandSuggestion): string | undefined {
    return this.focusedTerminalIdSignal() ?? commandSuggestion.targetTerminalId;
  }

  private async waitForCommandExecution(terminalId: string): Promise<"completed" | "timeout"> {
    const startedPromise = firstValueFrom(
      this.terminalGateway.busyStateChanges$.pipe(
        filter((event) => event.terminalId === terminalId && event.isBusy),
        map(() => true),
        timeout({ first: AiChatService.RUN_START_TIMEOUT_MS }),
      ),
    ).catch(() => false);
    const completedPromise = firstValueFrom(
      this.terminalGateway.busyStateChanges$.pipe(
        filter((event) => event.terminalId === terminalId && !event.isBusy),
        map(() => true),
        timeout({ first: AiChatService.RUN_COMPLETION_TIMEOUT_MS }),
      ),
    ).catch(() => false);

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

  private resolveSnapshotOptions(): TerminalSnapshotOptionsContract {
    const configuration = this.applicationConfigurationPort.getConfiguration() ?? {};
    const aiFeatureConfig = getAiFeatureConfig(configuration);
    return {
      maxCommands: aiFeatureConfig?.request?.max_commands ?? 8,
      maxOutputChars: aiFeatureConfig?.request?.max_output_chars ?? 4000,
      includeProcessSummary: aiFeatureConfig?.request?.include_process_tree ?? false,
    };
  }
}

function newMessageId(): string {
  return `MSG-${crypto.randomUUID()}`;
}
