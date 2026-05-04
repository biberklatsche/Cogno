export type LlmProviderType = "openai_compatible" | "ollama_native";

export type LlmProviderConfig = {
  readonly type: LlmProviderType;
  readonly base_url?: string;
  readonly model?: string;
  readonly api_key?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly enabled?: boolean;
};

export type LlmFeatureConfig = {
  readonly mode?: "off" | "hidden" | "visible";
  readonly active_provider?: string;
  readonly providers?: Readonly<Record<string, LlmProviderConfig>>;
  readonly request?: {
    readonly include_process_tree?: boolean;
    readonly max_commands?: number;
    readonly max_output_chars?: number;
  };
};

export type LlmChatRole = "system" | "user" | "assistant";

export type LlmChatMessage = {
  readonly role: LlmChatRole;
  readonly content: string;
};

export type LlmProviderCapabilitySet = {
  readonly supportsStreaming: boolean;
};

export type LlmStreamChunk = {
  readonly text: string;
  readonly done?: boolean;
};

export type LlmChatRequest = {
  readonly model: string;
  readonly messages: ReadonlyArray<LlmChatMessage>;
  readonly abortSignal?: AbortSignal;
};

export type LlmProviderError = {
  readonly message: string;
  readonly status?: number;
  readonly providerId: string;
  readonly providerType: LlmProviderType;
};

export type TerminalContextCommandSummary = {
  readonly id: string;
  readonly text?: string;
  readonly cwd?: string;
  readonly durationMs?: number;
  readonly returnCode?: number;
};

export type TerminalContextProcessSummary = {
  readonly processId?: number;
  readonly name?: string;
  readonly cwd?: string;
};

export type TerminalContextSnapshot = {
  readonly terminalId: string;
  readonly tabId?: string;
  readonly workspaceId?: string;
  readonly shellType?: string;
  readonly cwd?: string;
  readonly input?: string;
  readonly isCommandRunning: boolean;
  readonly commands: ReadonlyArray<TerminalContextCommandSummary>;
  readonly lastOutput?: string;
  readonly latestCommandOutput?: string;
  readonly process?: TerminalContextProcessSummary;
};

export type ChatTurnTargetTerminalReference = {
  readonly terminalId?: string;
};

export type LlmCommandSuggestion = {
  readonly command: string;
  readonly language?: string;
  readonly sourceMessageId: string;
  readonly target: ChatTurnTargetTerminalReference;
};

export type LlmChatThreadMessage = {
  readonly id: string;
  readonly role: "user" | "assistant" | "system";
  readonly text: string;
  readonly providerMessage: LlmChatMessage;
  readonly target: ChatTurnTargetTerminalReference;
  readonly commands?: ReadonlyArray<LlmCommandSuggestion>;
  readonly isPending?: boolean;
  readonly isError?: boolean;
};

export interface LlmProviderAdapter {
  readonly type: LlmProviderType;
  readonly capabilities: LlmProviderCapabilitySet;

  validateConfiguration(providerId: string, config: LlmProviderConfig): ReadonlyArray<string>;
  streamChat(
    providerId: string,
    config: LlmProviderConfig,
    request: LlmChatRequest,
  ): AsyncIterable<LlmStreamChunk>;
}
