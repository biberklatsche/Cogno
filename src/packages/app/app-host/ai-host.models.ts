export type AiProviderType = "openai_compatible" | "ollama_native";

export type AiProviderConfig = {
  readonly type: AiProviderType;
  readonly base_url?: string;
  readonly model?: string;
  readonly api_key?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly enabled?: boolean;
};

export type AiFeatureConfig = {
  readonly active_provider?: string;
  readonly providers?: Readonly<Record<string, AiProviderConfig>>;
  readonly request?: {
    readonly include_process_tree?: boolean;
    readonly max_commands?: number;
    readonly max_output_chars?: number;
  };
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

export type TerminalContextCommandSummary = {
  readonly id: string;
  readonly text?: string;
  readonly cwd?: string;
  readonly durationMs?: number;
  readonly returnCode?: number;
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
  readonly process?: {
    readonly processId?: number;
    readonly name?: string;
    readonly cwd?: string;
  };
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
  readonly target: ChatTurnTargetTerminalReference;
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
