import { Injectable } from "@angular/core";
import {
  ChatTurnTargetTerminalReference,
  LlmCommandExecutionMode,
  LlmCommandSuggestion,
} from "./llm-host.models";

type ExtractedCodeBlock = {
  readonly language?: string;
  readonly content: string;
  readonly executionMode: LlmCommandExecutionMode;
};

type StructuredCommandPayload = {
  readonly commands?: ReadonlyArray<{
    readonly command?: string;
    readonly language?: string;
    readonly executionMode?: string;
  }>;
};

type ParsedAssistantResponse = {
  readonly displayText: string;
  readonly commands: ReadonlyArray<LlmCommandSuggestion>;
};

@Injectable({ providedIn: "root" })
export class LlmCommandExtractionService {
  private static readonly COMMAND_BLOCK_PATTERN =
    /<cogno-commands>\s*([\s\S]*?)\s*<\/cogno-commands>/gi;

  parseAssistantResponse(
    messageId: string,
    text: string,
    target: ChatTurnTargetTerminalReference,
  ): ParsedAssistantResponse {
    const structuredCommands = this.extractStructuredCommands(messageId, text, target);
    const fallbackCommands =
      structuredCommands.length > 0 ? [] : this.extractCodeBlockCommands(messageId, text, target);

    return {
      displayText: this.stripStructuredCommandBlocks(text),
      commands: structuredCommands.length > 0 ? structuredCommands : fallbackCommands,
    };
  }

  extractCommands(
    messageId: string,
    text: string,
    target: ChatTurnTargetTerminalReference,
  ): ReadonlyArray<LlmCommandSuggestion> {
    return this.parseAssistantResponse(messageId, text, target).commands;
  }

  private extractStructuredCommands(
    messageId: string,
    text: string,
    target: ChatTurnTargetTerminalReference,
  ): ReadonlyArray<LlmCommandSuggestion> {
    const commands: LlmCommandSuggestion[] = [];
    const seenCommands = new Set<string>();

    for (const match of text.matchAll(LlmCommandExtractionService.COMMAND_BLOCK_PATTERN)) {
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
        if (!this.isShellLikeLanguage(language)) {
          continue;
        }

        seenCommands.add(normalizedCommand);
        commands.push({
          command: normalizedCommand,
          language,
          executionMode: this.normalizeExecutionMode(entry.executionMode),
          sourceMessageId: messageId,
          target,
        });
      }
    }

    return commands;
  }

  private extractCodeBlockCommands(
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
        executionMode: codeBlock.executionMode,
        sourceMessageId: messageId,
        target,
      });
    }

    return commands;
  }

  private stripStructuredCommandBlocks(text: string): string {
    if (!text.match(LlmCommandExtractionService.COMMAND_BLOCK_PATTERN)) {
      return text;
    }

    return text
      .replace(LlmCommandExtractionService.COMMAND_BLOCK_PATTERN, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  private extractCodeBlocks(text: string): ReadonlyArray<ExtractedCodeBlock> {
    const codeBlocks: ExtractedCodeBlock[] = [];
    const codeBlockPattern = /```([^\r\n]*)\r?\n([\s\S]*?)```/g;

    for (const match of text.matchAll(codeBlockPattern)) {
      const header = (match[1] ?? "").trim();
      codeBlocks.push({
        language: this.extractLanguage(header),
        content: match[2] ?? "",
        executionMode: this.extractExecutionMode(header),
      });
    }

    return codeBlocks;
  }

  private extractLanguage(header: string): string | undefined {
    const [language] = this.tokenizeHeader(header);
    return language?.trim().toLowerCase() || undefined;
  }

  private extractExecutionMode(header: string): LlmCommandExecutionMode {
    const metadataTokens = this.tokenizeHeader(header)
      .slice(1)
      .map((token) => token.toLowerCase());
    if (metadataTokens.includes("llm:continue")) {
      return "run_and_continue";
    }
    return "run_only";
  }

  private tokenizeHeader(header: string): string[] {
    return header
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 0);
  }

  private normalizeExecutionMode(executionMode: string | undefined): LlmCommandExecutionMode {
    return executionMode === "run_and_continue" ? "run_and_continue" : "run_only";
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
