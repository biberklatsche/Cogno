import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  effect,
  Signal,
  viewChild,
} from "@angular/core";
import { DropdownComponent, DropdownItem, IconComponent } from "@cogno/core-ui";
import {
  AiChatThreadMessage,
  AiCommandSuggestion,
  AiProviderStatus,
} from "@cogno/features/ai/ai.models";
import { AiChatService } from "@cogno/features/ai/ai-chat.service";

@Component({
  selector: "app-ai-chat-side",
  standalone: true,
  imports: [DropdownComponent, IconComponent],
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
          <app-dropdown
            ariaLabel="Select AI provider"
            [label]="statusLabel() ?? 'No provider configured'"
            [value]="selectedProviderId()"
            [items]="providerDropdownItems()"
            [disabled]="providerDropdownItems().length === 0"
            (valueChange)="selectProvider($event)">
          </app-dropdown>
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

      .chat-shell { display: grid; grid-template-rows: auto 1fr auto; gap: 0.75rem; height: 100%; min-height: 0; }
      .chat-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
      .status { font-size: 0.8rem; opacity: 0.75; }
      .toolbar-button, .send-button, .command-button {
        border: 1px solid var(--background-color-20l); border-radius: 6px; background: var(--background-color-10l); color: inherit; cursor: pointer;
      }
      .toolbar-button, .send-button { min-height: 2rem; padding: 0.45rem 0.8rem; }
      .message-list { display: flex; flex-direction: column; gap: 0.75rem; overflow: auto; min-height: 0; }
      .empty-state { padding: 0.75rem; border-radius: 8px; background: var(--background-color-10l); font-size: 0.9rem; opacity: 0.75; }
      .message-card { display: flex; flex-direction: column; gap: 0.5rem; padding: 0.75rem; border-radius: 10px; background: var(--background-color-10l); }
      .message-card.assistant { background: var(--background-color-20l); }
      .message-card.system { border: 1px solid var(--background-color-20l); }
      .message-header {
        display: flex; justify-content: space-between; gap: 0.5rem; font-size: 0.75rem; letter-spacing: 0.03em; opacity: 0.7; text-transform: uppercase;
      }
      .pending-indicator { display: inline-flex; align-items: center; justify-content: center; width: 1rem; height: 1rem; }

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

      .command-list { display: flex; flex-direction: column; gap: 0.5rem; }
      .command-card {
        display: grid; grid-template-columns: 1fr auto; gap: 0.5rem; align-items: start; padding: 0.6rem;
        border: 1px solid var(--background-color-20l); border-radius: 8px; background: var(--background-color-10l);
      }
      .command-card.disabled { opacity: 0.55; }
      .command-text { font-family: var(--font-family-monospace, monospace); font-size: 0.85rem; }
      .command-context-note {
        grid-column: 1 / -1; display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; margin-top: 0.1rem;
        padding-top: 0.4rem; border-top: 1px solid var(--background-color-20l); font-size: 0.72rem; opacity: 0.7;
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
        display: grid; gap: 0.5rem; padding: 0.65rem; border: 1px solid var(--background-color-20l);
        border-radius: 10px; background: var(--background-color-10l);
      }
      .composer-input {
        resize: none; min-height: 5.5rem; max-height: 12rem; border: 0; outline: none; background: transparent; color: inherit; padding: 0.1rem;
      }
      .composer-input:focus { outline: none; }

      .composer-actions { display: flex; align-items: center; gap: 0.35rem; justify-content: flex-end; }

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

      .icon-send-button app-icon { width: 1rem; height: 1rem; }
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
  readonly providerDropdownItems: Signal<ReadonlyArray<DropdownItem>> = computed(() =>
    this.providerStatuses().map((providerStatus) => ({
      value: providerStatus.providerId,
      label: this.formatProviderStatus(providerStatus) ?? providerStatus.providerId,
      disabled: providerStatus.providerId === this.selectedProviderId(),
    })),
  );
  readonly selectedProviderId: Signal<string | undefined> = computed(
    () => this.aiChatService.providerStatus()?.providerId,
  );
  private readonly messageListElement = viewChild<ElementRef<HTMLDivElement>>("messageListElement");
  private readonly composerElement = viewChild<ElementRef<HTMLTextAreaElement>>("composerElement");

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

  canApplyCommandSuggestion(commandSuggestion: AiCommandSuggestion): boolean {
    return this.aiChatService.canApplyCommandSuggestion(commandSuggestion);
  }

  isCommandSuggestionFromDifferentTerminal(commandSuggestion: AiCommandSuggestion): boolean {
    const targetTerminalId = commandSuggestion.targetTerminalId;
    const focusedTerminalId = this.focusedTerminalId();
    return !!targetTerminalId && !!focusedTerminalId && targetTerminalId !== focusedTerminalId;
  }

  applyCommandSuggestion(commandSuggestion: AiCommandSuggestion): void {
    this.aiChatService.applyCommandSuggestion(commandSuggestion);
  }

  openCommandSuggestionTerminal(commandSuggestion: AiCommandSuggestion): void {
    this.aiChatService.openCommandSuggestionTerminal(commandSuggestion);
  }

  async runCommandSuggestion(commandSuggestion: AiCommandSuggestion): Promise<void> {
    await this.aiChatService.runCommandSuggestion(commandSuggestion);
  }

  formatProviderStatus(providerStatus: AiProviderStatus | undefined): string | undefined {
    return this.aiChatService.formatStatusMessage(providerStatus);
  }

  async selectProvider(providerId: string): Promise<void> {
    await this.aiChatService.selectProvider(providerId);
  }

  getRunButtonLabel(commandSuggestion: AiCommandSuggestion): string {
    return commandSuggestion.executionMode === "run_and_continue" ? "Run + Continue" : "Run";
  }

  formatRole(message: AiChatThreadMessage): string {
    if (message.role === "assistant") {
      return "Assistant";
    }
    if (message.role === "system") {
      return "System";
    }
    return "You";
  }
}
