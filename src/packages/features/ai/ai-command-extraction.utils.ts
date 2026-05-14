import type { AiCommandExecutionMode } from "./ai.models";

export type ExtractedAiCommandSuggestion<TTarget> = {
  readonly command: string;
  readonly language?: string;
  readonly executionMode: AiCommandExecutionMode;
  readonly sourceMessageId: string;
  readonly target: TTarget;
};

export type ParsedAiAssistantResponse<TTarget> = {
  readonly displayText: string;
  readonly commands: ReadonlyArray<ExtractedAiCommandSuggestion<TTarget>>;
};

type ExtractedCodeBlock = {
  readonly language?: string;
  readonly content: string;
  readonly executionMode: AiCommandExecutionMode;
};

const CODE_BLOCK_PATTERN = /```([^\r\n]*)\r?\n([\s\S]*?)```/g;

export function parseAiAssistantResponse<TTarget>(
  messageId: string,
  text: string,
  target: TTarget,
): ParsedAiAssistantResponse<TTarget> {
  return {
    displayText: text,
    commands: extractCodeBlockCommands(messageId, text, target),
  };
}

export function extractAiCommandSuggestions<TTarget>(
  messageId: string,
  text: string,
  target: TTarget,
): ReadonlyArray<ExtractedAiCommandSuggestion<TTarget>> {
  return parseAiAssistantResponse(messageId, text, target).commands;
}

function extractCodeBlockCommands<TTarget>(
  messageId: string,
  text: string,
  target: TTarget,
): ReadonlyArray<ExtractedAiCommandSuggestion<TTarget>> {
  const codeBlocks = extractCodeBlocks(text);
  const commands: ExtractedAiCommandSuggestion<TTarget>[] = [];
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

function extractExecutionMode(header: string): AiCommandExecutionMode {
  const metadataTokens = tokenizeHeader(header)
    .slice(1)
    .map((token) => token.toLowerCase());
  if (metadataTokens.includes("ai:continue")) {
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

function isShellLikeLanguage(language: string | undefined): boolean {
  return Boolean(
    language &&
      ["sh", "shell", "bash", "zsh", "pwsh", "powershell", "cmd", "console", "text"].includes(
        language,
      ),
  );
}
