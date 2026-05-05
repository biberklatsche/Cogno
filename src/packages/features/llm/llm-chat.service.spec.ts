import { Injector, runInInjectionContext } from "@angular/core";
import type {
  LlmChatHostPort,
  LlmChatThreadMessageContract,
  LlmProviderStatusContract,
} from "@cogno/core-api";
import { BehaviorSubject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LlmChatService } from "./llm-chat.service";

describe("LlmChatService", () => {
  let sendPromptMock: ReturnType<typeof vi.fn>;
  let llmChatService: LlmChatService;

  beforeEach(() => {
    const threadMessagesSubject = new BehaviorSubject<ReadonlyArray<LlmChatThreadMessageContract>>(
      [],
    );
    const pendingSubject = new BehaviorSubject(false);
    const providerStatusSubject = new BehaviorSubject<LlmProviderStatusContract | undefined>({
      providerId: "provider-1",
      providerType: "openai_compatible",
    });
    sendPromptMock = vi.fn().mockResolvedValue(undefined);

    const hostPort: LlmChatHostPort = {
      threadMessages$: threadMessagesSubject.asObservable(),
      pending$: pendingSubject.asObservable(),
      providerStatus$: providerStatusSubject.asObservable(),
      sendPrompt: sendPromptMock,
      clearConversation: vi.fn(),
      canApplyCommandSuggestion: vi.fn().mockReturnValue(false),
      applyCommandSuggestion: vi.fn(),
      runCommandSuggestion: vi.fn().mockResolvedValue(undefined),
    };

    llmChatService = runInInjectionContext(
      Injector.create({ providers: [] }),
      () => new LlmChatService(hostPort),
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
    llmChatService.updateComposerText("list files");

    const sendPromise = llmChatService.sendCurrentPrompt();

    expect(llmChatService.composerText()).toBe("");
    resolveSendPrompt?.();
    await sendPromise;
  });

  it("restores the composer text when sending fails", async () => {
    sendPromptMock.mockRejectedValue(new Error("send failed"));
    llmChatService.updateComposerText("list files");

    await expect(llmChatService.sendCurrentPrompt()).rejects.toThrow("send failed");

    expect(llmChatService.composerText()).toBe("list files");
  });
});
