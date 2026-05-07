import { Injectable } from "@angular/core";
import {
  extractAiCommandSuggestions,
  ParsedAiAssistantResponse,
  parseAiAssistantResponse,
} from "@cogno/core-api";
import { AiCommandSuggestion, ChatTurnTargetTerminalReference } from "./ai.models";

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
    return extractAiCommandSuggestions(messageId, text, target);
  }
}
