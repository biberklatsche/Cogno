import { Observable } from "rxjs";

export type AiProviderStatusContract = {
  readonly providerId: string;
  readonly providerType: string;
  readonly providerModel: string;
};

export type AiCommandExecutionModeContract = "run_only" | "run_and_continue";

export type AiCommandSuggestionContract = {
  readonly command: string;
  readonly language?: string;
  readonly executionMode?: AiCommandExecutionModeContract;
  readonly sourceMessageId: string;
  readonly targetTerminalId?: string;
};

export type AiChatThreadMessageContract = {
  readonly id: string;
  readonly role: "user" | "assistant" | "system";
  readonly text: string;
  readonly commands?: ReadonlyArray<AiCommandSuggestionContract>;
  readonly targetTerminalId?: string;
  readonly isPending?: boolean;
  readonly isError?: boolean;
};

export interface AiChatHostPortContract {
  readonly threadMessages$: Observable<ReadonlyArray<AiChatThreadMessageContract>>;
  readonly pending$: Observable<boolean>;
  readonly providerStatus$: Observable<AiProviderStatusContract | undefined>;
  readonly providerStatuses$: Observable<ReadonlyArray<AiProviderStatusContract>>;
  readonly focusedTerminalId$: Observable<string | undefined>;
  clearConversation(): void;
  sendPrompt(prompt: string): Promise<void>;
  selectProvider(providerId: string): Promise<void>;
  canApplyCommandSuggestion(commandSuggestion: AiCommandSuggestionContract): boolean;
  applyCommandSuggestion(commandSuggestion: AiCommandSuggestionContract): void;
  openCommandSuggestionTerminal(commandSuggestion: AiCommandSuggestionContract): void;
  runCommandSuggestion(commandSuggestion: AiCommandSuggestionContract): Promise<void>;
}

export abstract class AiChatHostPort implements AiChatHostPortContract {
  abstract readonly threadMessages$: Observable<ReadonlyArray<AiChatThreadMessageContract>>;
  abstract readonly pending$: Observable<boolean>;
  abstract readonly providerStatus$: Observable<AiProviderStatusContract | undefined>;
  abstract readonly providerStatuses$: Observable<ReadonlyArray<AiProviderStatusContract>>;
  abstract readonly focusedTerminalId$: Observable<string | undefined>;
  abstract clearConversation(): void;
  abstract sendPrompt(prompt: string): Promise<void>;
  abstract selectProvider(providerId: string): Promise<void>;
  abstract canApplyCommandSuggestion(commandSuggestion: AiCommandSuggestionContract): boolean;
  abstract applyCommandSuggestion(commandSuggestion: AiCommandSuggestionContract): void;
  abstract openCommandSuggestionTerminal(commandSuggestion: AiCommandSuggestionContract): void;
  abstract runCommandSuggestion(commandSuggestion: AiCommandSuggestionContract): Promise<void>;
}
