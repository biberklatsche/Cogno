export type AiProviderType = "openai_compatible" | "ollama_native";

export type AiProviderStatus = {
  readonly providerId: string;
  readonly providerType: string;
  readonly providerModel: string;
};

export type AiProviderConfig = {
  readonly type: AiProviderType;
  readonly base_url?: string;
  readonly model?: string;
  readonly api_key?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly enabled?: boolean;
};

export type AiChatRole = "system" | "user" | "assistant";

export type AiChatMessage = {
  readonly role: AiChatRole;
  readonly content: string;
};

export type AiProviderCapabilitySet = {
  readonly supportsStreaming: boolean;
};

export type AiStreamChunk = {
  readonly text: string;
  readonly done?: boolean;
};

export type AiChatRequest = {
  readonly model: string;
  readonly messages: ReadonlyArray<AiChatMessage>;
  readonly abortSignal?: AbortSignal;
};

export type ChatTurnTargetTerminalReference = {
  readonly terminalId?: string;
};

export type AiCommandExecutionMode = "run_only" | "run_and_continue";

export type AiCommandSuggestion = {
  readonly command: string;
  readonly language?: string;
  readonly executionMode: AiCommandExecutionMode;
  readonly sourceMessageId: string;
  readonly targetTerminalId?: string;
};

export type AiChatThreadMessage = {
  readonly id: string;
  readonly role: "user" | "assistant" | "system";
  readonly text: string;
  readonly commands?: ReadonlyArray<AiCommandSuggestion>;
  readonly targetTerminalId?: string;
  readonly isPending?: boolean;
  readonly isError?: boolean;
};

export interface AiProviderAdapter {
  readonly type: AiProviderType;
  readonly capabilities: AiProviderCapabilitySet;
  validateConfiguration(providerId: string, config: AiProviderConfig): ReadonlyArray<string>;
  streamChat(
    providerId: string,
    config: AiProviderConfig,
    request: AiChatRequest,
  ): AsyncIterable<AiStreamChunk>;
}
