import { Injectable } from "@angular/core";
import { extractLlmCommandSuggestions } from "@cogno/core-api";
import { ChatTurnTargetTerminalReference, LlmCommandSuggestion } from "./llm-host.models";

@Injectable({ providedIn: "root" })
export class LlmCommandExtractionService {
  extractCommands(
    messageId: string,
    text: string,
    target: ChatTurnTargetTerminalReference,
  ): ReadonlyArray<LlmCommandSuggestion> {
    return extractLlmCommandSuggestions(messageId, text, target);
  }
}
