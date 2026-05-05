import type { LlmCommandExecutionModeContract } from "./llm.contract";

export type ExtractedLlmCommandSuggestion<TTarget> = {
  readonly command: string;
  readonly language?: string;
  readonly executionMode: LlmCommandExecutionModeContract;
  readonly sourceMessageId: string;
  readonly target: TTarget;
};

export type ParsedLlmAssistantResponse<TTarget> = {
  readonly displayText: string;
  readonly commands: ReadonlyArray<ExtractedLlmCommandSuggestion<TTarget>>;
};

type StructuredCommandPayload = {
  readonly commands?: ReadonlyArray<{
    readonly command?: string;
    readonly language?: string;
    readonly executionMode?: string;
  }>;
};

type ExtractedCodeBlock = {
  readonly language?: string;
  readonly content: string;
  readonly executionMode: LlmCommandExecutionModeContract;
};

const COMMAND_BLOCK_PATTERN = /<cogno-commands>\s*([\s\S]*?)\s*<\/cogno-commands>/gi;
const CODE_BLOCK_PATTERN = /```([^\r\n]*)\r?\n([\s\S]*?)```/g;

export function parseLlmAssistantResponse<TTarget>(
  messageId: string,
  text: string,
  target: TTarget,
): ParsedLlmAssistantResponse<TTarget> {
  const structuredCommands = extractStructuredCommands(messageId, text, target);
  const fallbackCommands =
    structuredCommands.length > 0 ? [] : extractCodeBlockCommands(messageId, text, target);

  return {
    displayText: stripStructuredCommandBlocks(text),
    commands: structuredCommands.length > 0 ? structuredCommands : fallbackCommands,
  };
}

export function extractLlmCommandSuggestions<TTarget>(
  messageId: string,
  text: string,
  target: TTarget,
): ReadonlyArray<ExtractedLlmCommandSuggestion<TTarget>> {
  return parseLlmAssistantResponse(messageId, text, target).commands;
}

function extractStructuredCommands<TTarget>(
  messageId: string,
  text: string,
  target: TTarget,
): ReadonlyArray<ExtractedLlmCommandSuggestion<TTarget>> {
  const commands: ExtractedLlmCommandSuggestion<TTarget>[] = [];
  const seenCommands = new Set<string>();

  for (const match of text.matchAll(COMMAND_BLOCK_PATTERN)) {
    const payloadText = (match[1] ?? "").trim();
    if (!payloadText) {
      continue;
    }

    let payload: StructuredCommandPayload;
    try {
      payload = JSON.parse(payloadText) as StructuredCommandPayload;
    } catch {
      continue;
    }

    for (const entry of payload.commands ?? []) {
      const normalizedCommand = entry.command?.trim();
      if (!normalizedCommand || seenCommands.has(normalizedCommand)) {
        continue;
      }

      const language = entry.language?.trim().toLowerCase();
      if (!isShellLikeLanguage(language)) {
        continue;
      }

      seenCommands.add(normalizedCommand);
      commands.push({
        command: normalizedCommand,
        language,
        executionMode: normalizeExecutionMode(entry.executionMode),
        sourceMessageId: messageId,
        target,
      });
    }
  }

  return commands;
}

function extractCodeBlockCommands<TTarget>(
  messageId: string,
  text: string,
  target: TTarget,
): ReadonlyArray<ExtractedLlmCommandSuggestion<TTarget>> {
  const codeBlocks = extractCodeBlocks(text);
  const commands: ExtractedLlmCommandSuggestion<TTarget>[] = [];
  const seenCommands = new Set<string>();

  for (const codeBlock of codeBlocks) {
    if (!isShellLikeLanguage(codeBlock.language)) {
      continue;
    }

    const normalizedCommand = codeBlock.content.trim();
    if (!normalizedCommand || seenCommands.has(normalizedCommand)) {
      continue;
    }

    seenCommands.add(normalizedCommand);
    commands.push({
      command: normalizedCommand,
      language: codeBlock.language,
      executionMode: codeBlock.executionMode,
      sourceMessageId: messageId,
      target,
    });
  }

  return commands;
}

function stripStructuredCommandBlocks(text: string): string {
  if (!text.match(COMMAND_BLOCK_PATTERN)) {
    return text;
  }

  return text.replace(COMMAND_BLOCK_PATTERN, "").replace(/\n{3,}/g, "\n\n").trim();
}

function extractCodeBlocks(text: string): ReadonlyArray<ExtractedCodeBlock> {
  const codeBlocks: ExtractedCodeBlock[] = [];

  for (const match of text.matchAll(CODE_BLOCK_PATTERN)) {
    const header = (match[1] ?? "").trim();
    codeBlocks.push({
      language: extractLanguage(header),
      content: match[2] ?? "",
      executionMode: extractExecutionMode(header),
    });
  }

  return codeBlocks;
}

function extractLanguage(header: string): string | undefined {
  const [language] = tokenizeHeader(header);
  return language?.trim().toLowerCase() || undefined;
}

function extractExecutionMode(header: string): LlmCommandExecutionModeContract {
  const metadataTokens = tokenizeHeader(header)
    .slice(1)
    .map((token) => token.toLowerCase());
  if (metadataTokens.includes("llm:continue")) {
    return "run_and_continue";
  }
  return "run_only";
}

function tokenizeHeader(header: string): string[] {
  return header
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function normalizeExecutionMode(
  executionMode: string | undefined,
): LlmCommandExecutionModeContract {
  return executionMode === "run_and_continue" ? "run_and_continue" : "run_only";
}

function isShellLikeLanguage(language: string | undefined): boolean {
  return Boolean(
    language &&
      ["sh", "shell", "bash", "zsh", "pwsh", "powershell", "cmd", "console", "text"].includes(
        language,
      ),
  );
}
