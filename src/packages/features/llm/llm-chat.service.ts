import { computed, Injectable, Signal, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import {
  LlmChatHostPort,
  LlmChatThreadMessageContract,
  LlmCommandSuggestionContract,
  LlmProviderStatusContract,
} from "@cogno/core-api";

@Injectable({ providedIn: "root" })
export class LlmChatService {
  private readonly composerTextSignal = signal("");

  readonly threadMessages: Signal<ReadonlyArray<LlmChatThreadMessageContract>>;
  readonly pending: Signal<boolean>;
  readonly providerStatus: Signal<LlmProviderStatusContract | undefined>;
  readonly composerText: Signal<string> = this.composerTextSignal.asReadonly();
  readonly canSend: Signal<boolean>;

  constructor(private readonly hostPort: LlmChatHostPort) {
    this.threadMessages = toSignal(this.hostPort.threadMessages$, { initialValue: [] });
    this.pending = toSignal(this.hostPort.pending$, { initialValue: false });
    this.providerStatus = toSignal(this.hostPort.providerStatus$, { initialValue: undefined });
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

    await this.hostPort.sendPrompt(prompt);
    this.composerTextSignal.set("");
  }

  clearConversation(): void {
    this.hostPort.clearConversation();
  }

  canApplyCommandSuggestion(commandSuggestion: LlmCommandSuggestionContract): boolean {
    return this.hostPort.canApplyCommandSuggestion(commandSuggestion);
  }

  applyCommandSuggestion(commandSuggestion: LlmCommandSuggestionContract): void {
    this.hostPort.applyCommandSuggestion(commandSuggestion);
  }

  async runCommandSuggestion(commandSuggestion: LlmCommandSuggestionContract): Promise<void> {
    await this.hostPort.runCommandSuggestion(commandSuggestion);
  }

  getStatusMessage(): string | undefined {
    const providerStatus = this.providerStatus();
    return providerStatus
      ? `${providerStatus.providerId} (${providerStatus.providerType})`
      : undefined;
  }
}
