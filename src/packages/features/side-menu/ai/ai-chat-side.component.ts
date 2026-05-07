import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  effect,
  Signal,
  signal,
  viewChild,
} from "@angular/core";
import {
  AiChatThreadMessageContract,
  AiCommandSuggestionContract,
  AiProviderStatusContract,
} from "@cogno/core-api";
import { IconComponent } from "@cogno/core-ui";
import { AiChatService } from "@cogno/features/ai/ai-chat.service";

@Component({
  selector: "app-ai-chat-side",
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chat-shell">
      <div class="chat-toolbar">
        <div class="status">
          @if (statusLabel()) {
            <span>{{ statusLabel() }}</span>
          } @else {
            <span>No provider configured</span>
          }
        </div>
        <button type="button" class="toolbar-button" (click)="clearConversation()">Clear</button>
      </div>

      <div #messageListElement class="message-list">
        @if (threadMessages().length === 0) {
          <div class="empty-state">
            Ask for commands, explanations, or troubleshooting help for the current terminal.
          </div>
        }

        @for (message of threadMessages(); track message.id) {
          <article class="message-card" [class.assistant]="message.role === 'assistant'" [class.system]="message.role === 'system'">
            <header class="message-header">
              <span>{{ formatRole(message) }}</span>
              @if (message.isPending) {
                <span class="pending-indicator" aria-label="Loading response">
                  <app-icon name="mdiLoading" class="spinner-icon"></app-icon>
                </span>
              }
              @if (message.isError) {
                <span>Error</span>
              }
            </header>
            <pre class="message-text">{{ message.text }}</pre>

            @if (message.commands?.length) {
              <div class="command-list">
                @for (command of message.commands; track command.command) {
                  <div class="command-card" [class.disabled]="!canApplyCommandSuggestion(command)">
                    <pre class="command-text">{{ command.command }}</pre>
                    <div class="command-actions">
                      <button
                        type="button"
                        class="command-button"
                        [disabled]="!canApplyCommandSuggestion(command)"
                        (click)="applyCommandSuggestion(command)">
                        <app-icon name="mdiConsole"></app-icon>
                        <span>Insert</span>
                      </button>
                      <button
                        type="button"
                        class="command-button run-button"
                        [disabled]="!canApplyCommandSuggestion(command)"
                        (click)="runCommandSuggestion(command)">
                        <app-icon name="mdiRocketLaunch"></app-icon>
                        <span>{{ getRunButtonLabel(command) }}</span>
                      </button>
                    </div>
                    @if (isCommandSuggestionFromDifferentTerminal(command)) {
                      <div class="command-context-note">
                        <span>Erzeugt auf Grundlage einer anderen Terminal-ID.</span>
                        <button
                          type="button"
                          class="command-context-link"
                          (click)="openCommandSuggestionTerminal(command)">
                          Terminal öffnen
                        </button>
                      </div>
                    }
                  </div>
                }
              </div>
            }
          </article>
        }
      </div>

      <div class="composer">
        <textarea
          #composerElement
          class="composer-input"
          data-side-menu-autofocus="true"
          spellcheck="false"
          autocomplete="off"
          autocorrect="off"
          data-private="off"
          rows="5"
          placeholder="Ask the configured AI assistant about the current terminal session..."
          [value]="composerText()"
          (input)="updateComposerText($event)"
          (keydown)="handleComposerKeydown($event)"></textarea>
        <div class="composer-actions">
          <div class="provider-selector-shell">
            <button
              #providerMenuButton
              type="button"
              class="provider-selector"
              aria-haspopup="menu"
              aria-label="Select AI provider"
              [attr.aria-expanded]="isProviderMenuOpen()"
              (click)="toggleProviderMenu()">
              <span class="provider-selector__label">
                {{ statusLabel() ?? "No provider configured" }}
              </span>
              <span class="provider-selector__chevron" aria-hidden="true"></span>
            </button>
            @if (isProviderMenuOpen()) {
              <div class="provider-menu" role="menu">
                @for (providerStatus of providerStatuses(); track providerStatus.providerId) {
                  <button
                    type="button"
                    class="provider-menu__item"
                    role="menuitem"
                    [class.provider-menu__item--active]="
                      formatProviderStatus(providerStatus) === statusLabel()
                    "
                    [disabled]="formatProviderStatus(providerStatus) === statusLabel()"
                    (click)="selectProvider(providerStatus.providerId)">
                    {{ formatProviderStatus(providerStatus) ?? providerStatus.providerId }}
                  </button>
                }
              </div>
            }
          </div>
          <button
            type="button"
            class="send-button icon-send-button"
            aria-label="Send"
            [disabled]="!canSend()"
            (click)="sendCurrentPrompt()">
            <app-icon name="mdiSend"></app-icon>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }

      .chat-shell {
        display: grid;
        grid-template-rows: auto 1fr auto;
        gap: 0.75rem;
        height: 100%;
        min-height: 0;
      }

      .chat-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
      }

      .status {
        font-size: 0.8rem;
        opacity: 0.75;
      }

      .toolbar-button,
      .send-button,
      .command-button {
        border: 1px solid var(--background-color-20l);
        border-radius: 6px;
        background: var(--background-color-10l);
        color: inherit;
        cursor: pointer;
      }

      .toolbar-button,
      .send-button {
        min-height: 2rem;
        padding: 0.45rem 0.8rem;
      }

      .message-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        overflow: auto;
        min-height: 0;
      }

      .empty-state {
        padding: 0.75rem;
        border-radius: 8px;
        background: var(--background-color-10l);
        font-size: 0.9rem;
        opacity: 0.75;
      }

      .message-card {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 0.75rem;
        border-radius: 10px;
        background: var(--background-color-10l);
      }

      .message-card.assistant {
        background: var(--background-color-20l);
      }

      .message-card.system {
        border: 1px solid var(--background-color-20l);
      }

      .message-header {
        display: flex;
        justify-content: space-between;
        gap: 0.5rem;
        font-size: 0.75rem;
        letter-spacing: 0.03em;
        opacity: 0.7;
        text-transform: uppercase;
      }

      .pending-indicator {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1rem;
        height: 1rem;
      }

      .spinner-icon {
        width: 1rem;
        height: 1rem;
        animation: spin 0.9s linear infinite;
      }

      @keyframes spin {
        from {
          transform: rotate(0deg);
        }

        to {
          transform: rotate(360deg);
        }
      }

      .message-text,
      .command-text {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        font-family: inherit;
      }

      .command-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .command-card {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 0.5rem;
        align-items: start;
        padding: 0.6rem;
        border-radius: 8px;
        border: 1px solid var(--background-color-20l);
        background: var(--background-color-10l);
      }

      .command-card.disabled {
        opacity: 0.55;
      }

      .command-text {
        font-family: var(--font-family-monospace, monospace);
        font-size: 0.85rem;
      }

      .command-context-note {
        grid-column: 1 / -1;
        display: flex;
        align-items: center;
        gap: 0.45rem;
        flex-wrap: wrap;
        margin-top: 0.1rem;
        padding-top: 0.4rem;
        border-top: 1px solid var(--background-color-20l);
        font-size: 0.72rem;
        opacity: 0.7;
      }

      .command-context-link {
        border: 0;
        padding: 0;
        background: transparent;
        color: inherit;
        cursor: pointer;
        font: inherit;
        text-decoration: underline;
      }

      .command-button {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        min-height: 2rem;
        padding: 0.35rem 0.6rem;
      }

      .command-actions {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }

      .run-button {
        background: var(--highlight-color-10l);
      }

      .composer {
        display: grid;
        gap: 0.5rem;
        padding: 0.65rem;
        border: 1px solid var(--background-color-20l);
        border-radius: 10px;
        background: var(--background-color-10l);
      }

      .composer-input {
        resize: none;
        min-height: 5.5rem;
        max-height: 12rem;
        border: 0;
        outline: none;
        background: transparent;
        color: inherit;
        padding: 0.1rem;
      }

      .composer-input:focus {
        outline: none;
      }

      .composer-actions {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        justify-content: flex-end;
      }

      .provider-selector {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        max-width: min(100%, 18rem);
        min-height: 1.6rem;
        padding: 0.15rem 0.45rem 0;
        border: 0;
        background: transparent;
        color: inherit;
        cursor: pointer;
        font: inherit;
        font-size: 0.9rem;
        font-weight: 600;
        line-height: 1.2;
      }

      .provider-selector-shell {
        position: relative;
        display: inline-flex;
        justify-content: flex-end;
      }

      .provider-selector:hover,
      .provider-selector:focus-visible {
        background: var(--background-color-20l);
        border-radius: 0.35rem;
        outline: none;
      }

      .provider-selector__label {
        display: block;
        max-width: 15ch;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .provider-selector__chevron {
        flex: 0 0 auto;
        width: 0.45rem;
        height: 0.45rem;
        border-right: 1.5px solid currentColor;
        border-bottom: 1.5px solid currentColor;
        transform: translateY(-0.1rem) rotate(45deg);
        opacity: 0.8;
      }

      .provider-menu {
        position: absolute;
        right: 0;
        bottom: calc(100% + 0.35rem);
        display: flex;
        flex-direction: column;
        min-width: 14rem;
        max-width: 20rem;
        padding: 0.35rem;
        border: 1px solid var(--background-color-20l);
        border-radius: 0.6rem;
        background: var(--background-color);
        box-shadow: 0 0.5rem 1.4rem rgb(0 0 0 / 18%);
        z-index: 5;
      }

      .provider-menu__item {
        border: 0;
        border-radius: 0.4rem;
        background: transparent;
        color: inherit;
        cursor: pointer;
        font: inherit;
        text-align: left;
        padding: 0.45rem 0.6rem;
      }

      .provider-menu__item:hover,
      .provider-menu__item:focus-visible {
        background: var(--background-color-20l);
        outline: none;
      }

      .provider-menu__item--active {
        opacity: 0.6;
      }

      .icon-send-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.5rem;
        min-height: 1.5rem;
        padding: 0;
        border: 0;
        border-radius: 0;
        background: transparent;
      }

      .icon-send-button app-icon {
        width: 1rem;
        height: 1rem;
      }
    `,
  ],
})
export class AiChatSideComponent {
  readonly threadMessages = this.aiChatService.threadMessages;
  readonly composerText = this.aiChatService.composerText;
  readonly canSend = this.aiChatService.canSend;
  readonly providerStatuses = this.aiChatService.providerStatuses;
  readonly focusedTerminalId = this.aiChatService.focusedTerminalId;
  readonly statusLabel: Signal<string | undefined> = computed(() =>
    this.aiChatService.getStatusMessage(),
  );
  readonly isProviderMenuOpen = signal(false);
  private readonly messageListElement = viewChild<ElementRef<HTMLDivElement>>("messageListElement");
  private readonly composerElement = viewChild<ElementRef<HTMLTextAreaElement>>("composerElement");
  private readonly providerMenuButton = viewChild<ElementRef<HTMLButtonElement>>("providerMenuButton");

  constructor(private readonly aiChatService: AiChatService) {
    effect(() => {
      this.threadMessages();
      queueMicrotask(() => {
        const messageListElement = this.messageListElement()?.nativeElement;
        if (!messageListElement) {
          return;
        }
        messageListElement.scrollTop = messageListElement.scrollHeight;
      });
    });
    effect(() => {
      this.statusLabel();
      this.providerStatuses();
      if (this.providerStatuses().length <= 1 && this.isProviderMenuOpen()) {
        this.isProviderMenuOpen.set(false);
      }
    });
  }

  updateComposerText(event: Event): void {
    const textareaElement = event.target as HTMLTextAreaElement;
    this.aiChatService.updateComposerText(textareaElement.value);
  }

  async sendCurrentPrompt(): Promise<void> {
    await this.aiChatService.sendCurrentPrompt();
    this.composerElement()?.nativeElement.focus();
  }

  clearConversation(): void {
    this.aiChatService.clearConversation();
  }

  toggleProviderMenu(): void {
    if (this.providerStatuses().length === 0) {
      return;
    }

    this.isProviderMenuOpen.update((isOpen) => !isOpen);
  }

  handleComposerKeydown(keyboardEvent: KeyboardEvent): void {
    if (
      keyboardEvent.key === "Enter" &&
      !keyboardEvent.shiftKey &&
      !keyboardEvent.ctrlKey &&
      !keyboardEvent.metaKey &&
      !keyboardEvent.altKey
    ) {
      keyboardEvent.preventDefault();
      void this.sendCurrentPrompt();
    }
  }

  canApplyCommandSuggestion(commandSuggestion: AiCommandSuggestionContract): boolean {
    return this.aiChatService.canApplyCommandSuggestion(commandSuggestion);
  }

  isCommandSuggestionFromDifferentTerminal(
    commandSuggestion: AiCommandSuggestionContract,
  ): boolean {
    const targetTerminalId = commandSuggestion.targetTerminalId;
    const focusedTerminalId = this.focusedTerminalId();
    return !!targetTerminalId && !!focusedTerminalId && targetTerminalId !== focusedTerminalId;
  }

  applyCommandSuggestion(commandSuggestion: AiCommandSuggestionContract): void {
    this.aiChatService.applyCommandSuggestion(commandSuggestion);
  }

  openCommandSuggestionTerminal(commandSuggestion: AiCommandSuggestionContract): void {
    this.aiChatService.openCommandSuggestionTerminal(commandSuggestion);
  }

  async runCommandSuggestion(commandSuggestion: AiCommandSuggestionContract): Promise<void> {
    await this.aiChatService.runCommandSuggestion(commandSuggestion);
  }

  formatProviderStatus(providerStatus: AiProviderStatusContract | undefined): string | undefined {
    return this.aiChatService.formatStatusMessage(providerStatus);
  }

  async selectProvider(providerId: string): Promise<void> {
    this.isProviderMenuOpen.set(false);
    await this.aiChatService.selectProvider(providerId);
    this.providerMenuButton()?.nativeElement.focus();
  }

  getRunButtonLabel(commandSuggestion: AiCommandSuggestionContract): string {
    return commandSuggestion.executionMode === "run_and_continue" ? "Run + Continue" : "Run";
  }

  formatRole(message: AiChatThreadMessageContract): string {
    if (message.role === "assistant") {
      return "Assistant";
    }
    if (message.role === "system") {
      return "System";
    }
    return "You";
  }

}
