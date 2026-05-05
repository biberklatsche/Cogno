import { DestroyRef } from "@angular/core";
import { EMPTY } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppBus } from "../app-bus/app-bus";
import { LlmChatHostPortAdapterService } from "./llm-chat-host-port.adapter.service";
import { LlmCommandExtractionService } from "./llm-command-extraction.service";
import { LlmContextSnapshotService } from "./llm-context-snapshot.service";
import { LlmProviderAdapter, LlmProviderConfig } from "./llm-host.models";
import { LlmProviderRegistryService, ResolvedLlmProvider } from "./llm-provider-registry.service";

function createDeferredPromise<T>() {
  let resolvePromise!: (value: T | PromiseLike<T>) => void;
  let rejectPromise!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return {
    promise,
    resolvePromise,
    rejectPromise,
  };
}

describe("LlmChatHostPortAdapterService", () => {
  let appBus: AppBus;
  let llmCommandExtractionService: LlmCommandExtractionService;
  let llmContextSnapshotService: LlmContextSnapshotService;
  let providerRegistryService: LlmProviderRegistryService;

  beforeEach(() => {
    appBus = {
      onType$: vi.fn().mockReturnValue(EMPTY),
      once$: vi.fn().mockReturnValue(EMPTY),
      publish: vi.fn(),
    } as unknown as AppBus;
    llmCommandExtractionService = {
      extractCommands: vi.fn().mockReturnValue([]),
    } as unknown as LlmCommandExtractionService;
    llmContextSnapshotService = {
      captureFocusedTerminalContext: vi.fn().mockResolvedValue(undefined),
      captureTerminalContext: vi.fn().mockResolvedValue(undefined),
      hasTerminal: vi.fn().mockReturnValue(true),
    } as unknown as LlmContextSnapshotService;
    providerRegistryService = {
      resolveActiveProvider: vi.fn(),
      validateActiveProvider: vi.fn().mockReturnValue([]),
    } as unknown as LlmProviderRegistryService;
  });

  it("keeps pending state until the latest prompt finishes", async () => {
    const firstCompletion = createDeferredPromise<{ text: string }>();
    const secondCompletion = createDeferredPromise<{ text: string }>();
    const pendingStates: boolean[] = [];
    let providerCallCount = 0;

    const adapter: LlmProviderAdapter = {
      type: "openai_compatible",
      validateConfiguration: vi.fn().mockReturnValue([]),
      completeChat: vi.fn().mockImplementation(() => {
        providerCallCount += 1;
        return providerCallCount === 1 ? firstCompletion.promise : secondCompletion.promise;
      }),
    };
    const providerConfig: LlmProviderConfig = {
      type: "openai_compatible",
      base_url: "http://localhost:1234/v1",
      model: "gpt-oss",
      enabled: true,
    };
    const resolvedProvider: ResolvedLlmProvider = {
      providerId: "local",
      config: providerConfig,
      adapter,
    };

    vi.mocked(providerRegistryService.resolveActiveProvider).mockReturnValue(resolvedProvider);

    const service = new LlmChatHostPortAdapterService(
      { onDestroy: vi.fn() } as unknown as DestroyRef,
      appBus,
      llmCommandExtractionService,
      llmContextSnapshotService,
      providerRegistryService,
    );

    service.pending$.subscribe((isPending) => {
      pendingStates.push(isPending);
    });

    const firstSendPromise = service.sendPrompt("first prompt");
    await Promise.resolve();
    const secondSendPromise = service.sendPrompt("second prompt");
    await Promise.resolve();

    firstCompletion.resolvePromise({ text: "first response" });
    await firstSendPromise;

    expect(pendingStates.at(-1)).toBe(true);

    secondCompletion.resolvePromise({ text: "second response" });
    await secondSendPromise;

    expect(pendingStates.at(-1)).toBe(false);
  });

  it("does not re-add messages after an aborted request is cleared", async () => {
    const abortedCompletion = createDeferredPromise<{ text: string }>();

    const adapter: LlmProviderAdapter = {
      type: "openai_compatible",
      validateConfiguration: vi.fn().mockReturnValue([]),
      completeChat: vi.fn().mockImplementation(() => abortedCompletion.promise),
    };
    const providerConfig: LlmProviderConfig = {
      type: "openai_compatible",
      base_url: "http://localhost:1234/v1",
      model: "gpt-oss",
      enabled: true,
    };

    vi.mocked(providerRegistryService.resolveActiveProvider).mockReturnValue({
      providerId: "local",
      config: providerConfig,
      adapter,
    });

    const service = new LlmChatHostPortAdapterService(
      { onDestroy: vi.fn() } as unknown as DestroyRef,
      appBus,
      llmCommandExtractionService,
      llmContextSnapshotService,
      providerRegistryService,
    );

    const sendPromise = service.sendPrompt("first prompt");
    await Promise.resolve();
    service.clearConversation();
    abortedCompletion.rejectPromise(new DOMException("The operation was aborted.", "AbortError"));
    await sendPromise;

    let threadMessageCount = -1;
    service.threadMessages$.subscribe((messages) => {
      threadMessageCount = messages.length;
    });

    expect(threadMessageCount).toBe(0);
  });
});
