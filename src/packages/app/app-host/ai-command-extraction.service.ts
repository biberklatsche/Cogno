import { Injectable } from "@angular/core";
import {
  extractAiCommandSuggestions,
  ParsedAiAssistantResponse,
  parseAiAssistantResponse,
} from "@cogno/feature-api/ai/ai-command-extraction.utils";
import { AiCommandSuggestion, ChatTurnTargetTerminalReference } from "./ai-host.models";

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
