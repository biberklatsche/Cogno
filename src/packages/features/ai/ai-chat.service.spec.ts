import { Injector, runInInjectionContext } from "@angular/core";
import type {
  AiChatHostPort,
  AiChatThreadMessageContract,
  AiProviderStatusContract,
} from "@cogno/feature-api/ai/ai-chat.port";
import { BehaviorSubject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiChatService } from "./ai-chat.service";

describe("AiChatService", () => {
  let sendPromptMock: ReturnType<typeof vi.fn>;
  let aiChatService: AiChatService;

  beforeEach(() => {
    const threadMessagesSubject = new BehaviorSubject<ReadonlyArray<AiChatThreadMessageContract>>(
      [],
    );
    const pendingSubject = new BehaviorSubject(false);
    const providerStatusSubject = new BehaviorSubject<AiProviderStatusContract | undefined>({
      providerId: "provider-1",
      providerType: "openai_compatible",
      providerModel: "gpt-test",
    });
    const providerStatusesSubject = new BehaviorSubject<ReadonlyArray<AiProviderStatusContract>>(
      [],
    );
    sendPromptMock = vi.fn().mockResolvedValue(undefined);

    const hostPort: AiChatHostPort = {
      threadMessages$: threadMessagesSubject.asObservable(),
      pending$: pendingSubject.asObservable(),
      providerStatus$: providerStatusSubject.asObservable(),
      providerStatuses$: providerStatusesSubject.asObservable(),
      focusedTerminalId$: new BehaviorSubject<string | undefined>(undefined).asObservable(),
      sendPrompt: sendPromptMock,
      selectProvider: vi.fn().mockResolvedValue(undefined),
      clearConversation: vi.fn(),
      canApplyCommandSuggestion: vi.fn().mockReturnValue(false),
      applyCommandSuggestion: vi.fn(),
      openCommandSuggestionTerminal: vi.fn(),
      runCommandSuggestion: vi.fn().mockResolvedValue(undefined),
    };

    aiChatService = runInInjectionContext(
      Injector.create({ providers: [] }),
      () => new AiChatService(hostPort),
    );
  });

  it("clears the composer immediately when sending a prompt", async () => {
    let resolveSendPrompt: (() => void) | undefined;
    sendPromptMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSendPrompt = resolve;
        }),
    );
    aiChatService.updateComposerText("list files");

    const sendPromise = aiChatService.sendCurrentPrompt();

    expect(aiChatService.composerText()).toBe("");
    resolveSendPrompt?.();
    await sendPromise;
  });

  it("restores the composer text when sending fails", async () => {
    sendPromptMock.mockRejectedValue(new Error("send failed"));
    aiChatService.updateComposerText("list files");

    await expect(aiChatService.sendCurrentPrompt()).rejects.toThrow("send failed");

    expect(aiChatService.composerText()).toBe("list files");
  });

  it("formats provider statuses consistently", () => {
    expect(
      aiChatService.formatStatusMessage({
        providerId: "provider-2",
        providerType: "ollama_native",
        providerModel: "llama3.1",
      }),
    ).toBe("provider-2 (llama3.1)");
  });
});
