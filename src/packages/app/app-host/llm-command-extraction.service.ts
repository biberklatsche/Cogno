import { Injectable } from "@angular/core";
import { ChatTurnTargetTerminalReference, LlmCommandSuggestion } from "./llm-host.models";

type ExtractedCodeBlock = {
  readonly language?: string;
  readonly content: string;
};

@Injectable({ providedIn: "root" })
export class LlmCommandExtractionService {
  extractCommands(
    messageId: string,
    text: string,
    target: ChatTurnTargetTerminalReference,
  ): ReadonlyArray<LlmCommandSuggestion> {
    const codeBlocks = this.extractCodeBlocks(text);
    const commands: LlmCommandSuggestion[] = [];
    const seenCommands = new Set<string>();

    for (const codeBlock of codeBlocks) {
      if (!this.isShellLikeLanguage(codeBlock.language)) {
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

  private extractCodeBlocks(text: string): ReadonlyArray<ExtractedCodeBlock> {
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

  private isShellLikeLanguage(language: string | undefined): boolean {
    if (!language) {
      return true;
    }

    return ["sh", "shell", "bash", "zsh", "pwsh", "powershell", "cmd", "console", "text"].includes(
      language,
    );
  }
}
