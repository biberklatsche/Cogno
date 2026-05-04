import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  effect,
  Signal,
  viewChild,
} from "@angular/core";
import { LlmChatThreadMessageContract, LlmCommandSuggestionContract } from "@cogno/core-api";
import { IconComponent } from "@cogno/core-ui";
import { LlmChatService } from "@cogno/features/llm/llm-chat.service";

@Component({
  selector: "app-llm-chat-side",
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
                  <app-icon name="mdiRefreshAuto" class="spinner-icon"></app-icon>
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
                        <span>Run</span>
                      </button>
                    </div>
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
          placeholder="Ask the configured LLM about the current terminal session..."
          [value]="composerText()"
          (input)="updateComposerText($event)"
          (keydown)="handleComposerKeydown($event)"></textarea>
        <button type="button" class="send-button" [disabled]="!canSend()" (click)="sendCurrentPrompt()">
          Send
        </button>
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
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.05);
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
        background: rgba(255, 255, 255, 0.03);
        font-size: 0.9rem;
        opacity: 0.75;
      }

      .message-card {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 0.75rem;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.04);
      }

      .message-card.assistant {
        background: rgba(255, 255, 255, 0.06);
      }

      .message-card.system {
        border: 1px solid rgba(255, 255, 255, 0.12);
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
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(0, 0, 0, 0.16);
      }

      .command-card.disabled {
        opacity: 0.55;
      }

      .command-text {
        font-family: var(--font-family-monospace, monospace);
        font-size: 0.85rem;
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
        background: rgba(52, 187, 254, 0.16);
      }

      .composer {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 0.5rem;
      }

      .composer-input {
        resize: vertical;
        min-height: 5.5rem;
        max-height: 12rem;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        background: rgba(255, 255, 255, 0.04);
        color: inherit;
        padding: 0.75rem;
      }
    `,
  ],
})
export class LlmChatSideComponent {
  readonly threadMessages = this.llmChatService.threadMessages;
  readonly composerText = this.llmChatService.composerText;
  readonly canSend = this.llmChatService.canSend;
  readonly statusLabel: Signal<string | undefined> = computed(() =>
    this.llmChatService.getStatusMessage(),
  );
  private readonly messageListElement = viewChild<ElementRef<HTMLDivElement>>("messageListElement");
  private readonly composerElement = viewChild<ElementRef<HTMLTextAreaElement>>("composerElement");

  constructor(private readonly llmChatService: LlmChatService) {
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
    this.llmChatService.updateComposerText(textareaElement.value);
  }

  async sendCurrentPrompt(): Promise<void> {
    await this.llmChatService.sendCurrentPrompt();
    this.composerElement()?.nativeElement.focus();
  }

  clearConversation(): void {
    this.llmChatService.clearConversation();
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

  canApplyCommandSuggestion(commandSuggestion: LlmCommandSuggestionContract): boolean {
    return this.llmChatService.canApplyCommandSuggestion(commandSuggestion);
  }

  applyCommandSuggestion(commandSuggestion: LlmCommandSuggestionContract): void {
    this.llmChatService.applyCommandSuggestion(commandSuggestion);
  }

  async runCommandSuggestion(commandSuggestion: LlmCommandSuggestionContract): Promise<void> {
    await this.llmChatService.runCommandSuggestion(commandSuggestion);
  }

  formatRole(message: LlmChatThreadMessageContract): string {
    if (message.role === "assistant") {
      return "Assistant";
    }
    if (message.role === "system") {
      return "System";
    }
    return "You";
  }
}
