import { Injectable } from "@angular/core";
import {
  extractLlmCommandSuggestions,
  ParsedLlmAssistantResponse,
  parseLlmAssistantResponse,
} from "@cogno/core-api";
import { ChatTurnTargetTerminalReference, LlmCommandSuggestion } from "./llm.models";

@Injectable({ providedIn: "root" })
export class LlmCommandExtractionService {
  parseAssistantResponse(
    messageId: string,
    text: string,
    target: ChatTurnTargetTerminalReference,
  ): ParsedLlmAssistantResponse<ChatTurnTargetTerminalReference> {
    return parseLlmAssistantResponse(messageId, text, target);
  }

  extractCommands(
    messageId: string,
    text: string,
    target: ChatTurnTargetTerminalReference,
  ): ReadonlyArray<LlmCommandSuggestion> {
    return extractLlmCommandSuggestions(messageId, text, target);
  }
}
