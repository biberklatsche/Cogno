export type ExtractedLlmCommandSuggestion<TTarget> = {
  readonly command: string;
  readonly language?: string;
  readonly sourceMessageId: string;
  readonly target: TTarget;
};

type ExtractedCodeBlock = {
  readonly language?: string;
  readonly content: string;
};

export function extractLlmCommandSuggestions<TTarget>(
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
      sourceMessageId: messageId,
      target,
    });
  }

  return commands;
}

function extractCodeBlocks(text: string): ReadonlyArray<ExtractedCodeBlock> {
  const codeBlocks: ExtractedCodeBlock[] = [];
  const codeBlockPattern = /```([a-zA-Z0-9_-]+)?\r?\n([\s\S]*?)```/g;

  for (const match of text.matchAll(codeBlockPattern)) {
    codeBlocks.push({
      language: match[1]?.trim().toLowerCase(),
      content: match[2] ?? "",
    });
  }

  return codeBlocks;
}

function isShellLikeLanguage(language: string | undefined): boolean {
  return Boolean(
    language &&
      ["sh", "shell", "bash", "zsh", "pwsh", "powershell", "cmd", "console", "text"].includes(
        language,
      ),
  );
}
