import { Observable } from "rxjs";

export type LlmProviderStatusContract = {
  readonly providerId: string;
  readonly providerType: string;
};

export type LlmCommandSuggestionContract = {
  readonly command: string;
  readonly language?: string;
  readonly sourceMessageId: string;
  readonly targetTerminalId?: string;
};

export type LlmChatThreadMessageContract = {
  readonly id: string;
  readonly role: "user" | "assistant" | "system";
  readonly text: string;
  readonly commands?: ReadonlyArray<LlmCommandSuggestionContract>;
  readonly targetTerminalId?: string;
  readonly isPending?: boolean;
  readonly isError?: boolean;
};

export interface LlmChatHostPortContract {
  readonly threadMessages$: Observable<ReadonlyArray<LlmChatThreadMessageContract>>;
  readonly pending$: Observable<boolean>;
  readonly providerStatus$: Observable<LlmProviderStatusContract | undefined>;
  clearConversation(): void;
  sendPrompt(prompt: string): Promise<void>;
  canApplyCommandSuggestion(commandSuggestion: LlmCommandSuggestionContract): boolean;
  applyCommandSuggestion(commandSuggestion: LlmCommandSuggestionContract): void;
  runCommandSuggestion(commandSuggestion: LlmCommandSuggestionContract): Promise<void>;
}

export abstract class LlmChatHostPort implements LlmChatHostPortContract {
  abstract readonly threadMessages$: Observable<ReadonlyArray<LlmChatThreadMessageContract>>;
  abstract readonly pending$: Observable<boolean>;
  abstract readonly providerStatus$: Observable<LlmProviderStatusContract | undefined>;
  abstract clearConversation(): void;
  abstract sendPrompt(prompt: string): Promise<void>;
  abstract canApplyCommandSuggestion(commandSuggestion: LlmCommandSuggestionContract): boolean;
  abstract applyCommandSuggestion(commandSuggestion: LlmCommandSuggestionContract): void;
  abstract runCommandSuggestion(commandSuggestion: LlmCommandSuggestionContract): Promise<void>;
}
