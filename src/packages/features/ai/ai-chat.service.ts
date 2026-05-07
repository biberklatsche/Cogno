import { computed, Injectable, Signal, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import {
  AiChatHostPort,
  AiChatThreadMessageContract,
  AiCommandSuggestionContract,
  AiProviderStatusContract,
} from "@cogno/core-api";

@Injectable({ providedIn: "root" })
export class AiChatService {
  private readonly composerTextSignal = signal("");

  readonly threadMessages: Signal<ReadonlyArray<AiChatThreadMessageContract>>;
  readonly pending: Signal<boolean>;
  readonly providerStatus: Signal<AiProviderStatusContract | undefined>;
  readonly providerStatuses: Signal<ReadonlyArray<AiProviderStatusContract>>;
  readonly focusedTerminalId: Signal<string | undefined>;
  readonly composerText: Signal<string> = this.composerTextSignal.asReadonly();
  readonly canSend: Signal<boolean>;

  constructor(private readonly hostPort: AiChatHostPort) {
    this.threadMessages = toSignal(this.hostPort.threadMessages$, { initialValue: [] });
    this.pending = toSignal(this.hostPort.pending$, { initialValue: false });
    this.providerStatus = toSignal(this.hostPort.providerStatus$, { initialValue: undefined });
    this.providerStatuses = toSignal(this.hostPort.providerStatuses$, { initialValue: [] });
    this.focusedTerminalId = toSignal(this.hostPort.focusedTerminalId$, {
      initialValue: undefined,
    });
    this.canSend = computed(() => {
      return !this.pending() && this.composerText().trim().length > 0 && !!this.providerStatus();
    });
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
      await this.hostPort.sendPrompt(prompt);
    } catch (error) {
      if (!this.composerTextSignal()) {
        this.composerTextSignal.set(prompt);
      }
      throw error;
    }
  }

  clearConversation(): void {
    this.hostPort.clearConversation();
  }

  async selectProvider(providerId: string): Promise<void> {
    await this.hostPort.selectProvider(providerId);
  }

  canApplyCommandSuggestion(commandSuggestion: AiCommandSuggestionContract): boolean {
    return this.hostPort.canApplyCommandSuggestion(commandSuggestion);
  }

  applyCommandSuggestion(commandSuggestion: AiCommandSuggestionContract): void {
    this.hostPort.applyCommandSuggestion(commandSuggestion);
  }

  openCommandSuggestionTerminal(commandSuggestion: AiCommandSuggestionContract): void {
    this.hostPort.openCommandSuggestionTerminal(commandSuggestion);
  }

  async runCommandSuggestion(commandSuggestion: AiCommandSuggestionContract): Promise<void> {
    await this.hostPort.runCommandSuggestion(commandSuggestion);
  }

  getStatusMessage(): string | undefined {
    return this.formatStatusMessage(this.providerStatus());
  }

  formatStatusMessage(providerStatus: AiProviderStatusContract | undefined): string | undefined {
    return providerStatus
      ? `${providerStatus.providerId} (${providerStatus.providerModel})`
      : undefined;
  }
}
