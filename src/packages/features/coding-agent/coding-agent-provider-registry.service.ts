import { Injectable } from "@angular/core";
import { ICodingAgentProvider } from "@cogno/core-api";
import { ClaudeCodeProvider } from "./providers/claude-code/claude-code.provider";
import { CodexProvider } from "./providers/codex/codex.provider";
import { GeminiProvider } from "./providers/gemini/gemini.provider";
import { KimiProvider } from "./providers/kimi/kimi.provider";

@Injectable({ providedIn: "root" })
export class CodingAgentProviderRegistry {
  readonly providers: ReadonlyArray<ICodingAgentProvider>;

  constructor(
    claudeCode: ClaudeCodeProvider,
    codex: CodexProvider,
    gemini: GeminiProvider,
    kimi: KimiProvider,
  ) {
    this.providers = [claudeCode, codex, gemini, kimi];
  }
}
