import { Injectable } from "@angular/core";
import { AiCommandSuggestion, ChatTurnTargetTerminalReference } from "./ai.models";
import {
  extractAiCommandSuggestions,
  ParsedAiAssistantResponse,
  parseAiAssistantResponse,
} from "./ai-command-extraction.utils";

@Injectable({ providedIn: "root" })
export class AiCommandExtractionService {
  parseAssistantResponse(
    messageId: string,
    text: string,
    target: ChatTurnTargetTerminalReference,
  ): ParsedAiAssistantResponse<ChatTurnTargetTerminalReference> {
    return parseAiAssistantResponse(messageId, text, target);
  }

  extractCommands(
    messageId: string,
    text: string,
    target: ChatTurnTargetTerminalReference,
  ): ReadonlyArray<AiCommandSuggestion> {
    return extractAiCommandSuggestions(messageId, text, target).map((commandSuggestion) => ({
      command: commandSuggestion.command,
      language: commandSuggestion.language,
      executionMode: commandSuggestion.executionMode,
      sourceMessageId: commandSuggestion.sourceMessageId,
      targetTerminalId: commandSuggestion.target.terminalId,
    }));
  }
}
