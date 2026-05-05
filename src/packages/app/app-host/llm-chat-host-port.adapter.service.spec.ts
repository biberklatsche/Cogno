import type { LlmChatThreadMessageContract } from "@cogno/core-api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDestroyRef } from "../../__test__/test-factory";
import { AppBus } from "../app-bus/app-bus";
import { LlmChatHostPortAdapterService } from "./llm-chat-host-port.adapter.service";
import { LlmCommandExtractionService } from "./llm-command-extraction.service";
import { LlmContextSnapshotService } from "./llm-context-snapshot.service";
import { LlmProviderRegistryService } from "./llm-provider-registry.service";

describe("LlmChatHostPortAdapterService", () => {
  let appBus: AppBus;
  let latestMessages: ReadonlyArray<LlmChatThreadMessageContract>;

  beforeEach(() => {
    appBus = new AppBus();
    latestMessages = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("streams assistant text incrementally and exposes commands only after a full code block", async () => {
    const firstChunk = createDeferred<void>();
    const secondChunk = createDeferred<void>();
    const providerAdapter = {
      type: "openai_compatible" as const,
      capabilities: { supportsStreaming: true },
      validateConfiguration: vi.fn().mockReturnValue([]),
      streamChat: vi.fn(async function* () {
        await firstChunk.promise;
        yield { text: "Use this command:\n```sh\n" };
        await secondChunk.promise;
        yield { text: "echo hi\n```" };
        yield { text: "", done: true };
      }),
    };
    const providerRegistryService = {
      resolveActiveProvider: vi.fn().mockReturnValue({
        providerId: "provider-1",
        config: {
          type: "openai_compatible" as const,
          model: "gpt-test",
        },
        adapter: providerAdapter,
      }),
      validateActiveProvider: vi.fn().mockReturnValue([]),
    } as unknown as LlmProviderRegistryService;
    const llmContextSnapshotService = {
      captureFocusedTerminalContext: vi.fn().mockResolvedValue({
        terminalId: "terminal-1",
        isCommandRunning: false,
        commands: [],
      }),
      captureTerminalContext: vi.fn(),
      hasTerminal: vi.fn().mockReturnValue(true),
    } as unknown as LlmContextSnapshotService;
    const service = new LlmChatHostPortAdapterService(
      getDestroyRef(),
      appBus,
      new LlmCommandExtractionService(),
      llmContextSnapshotService,
      providerRegistryService,
    );
    service.threadMessages$.subscribe((messages) => {
      latestMessages = messages;
    });

    const sendPromise = service.sendPrompt("suggest a command");
    await flushPromises();

    expect(latestMessages).toHaveLength(2);
    expect(latestMessages[1]).toMatchObject({
      role: "assistant",
      text: "",
      commands: [],
      isPending: true,
    });

    firstChunk.resolve(undefined);
    await flushPromises();

    expect(latestMessages[1]).toMatchObject({
      text: "Use this command:\n```sh\n",
      commands: [],
      isPending: true,
    });

    secondChunk.resolve(undefined);
    await sendPromise;

    expect(latestMessages[1]).toMatchObject({
      text: "Use this command:\n```sh\necho hi\n```",
      isPending: false,
      isError: false,
    });
    expect(latestMessages[1].commands).toEqual([
      {
        command: "echo hi",
        language: "sh",
        executionMode: "run_only",
        sourceMessageId: latestMessages[1].id,
        targetTerminalId: "terminal-1",
      },
    ]);
  });

  it("extracts continue mode directly from the visible code fence header", async () => {
    const providerAdapter = {
      type: "openai_compatible" as const,
      capabilities: { supportsStreaming: true },
      validateConfiguration: vi.fn().mockReturnValue([]),
      streamChat: vi.fn(async function* () {
        yield {
          text: ["Check this first:", "```sh llm:continue", "docker ps", "```"].join("\n"),
          done: true,
        };
      }),
    };
    const providerRegistryService = {
      resolveActiveProvider: vi.fn().mockReturnValue({
        providerId: "provider-1",
        config: {
          type: "openai_compatible" as const,
          model: "gpt-test",
        },
        adapter: providerAdapter,
      }),
      validateActiveProvider: vi.fn().mockReturnValue([]),
    } as unknown as LlmProviderRegistryService;
    const llmContextSnapshotService = {
      captureFocusedTerminalContext: vi.fn().mockResolvedValue({
        terminalId: "terminal-1",
        isCommandRunning: false,
        commands: [],
      }),
      captureTerminalContext: vi.fn(),
      hasTerminal: vi.fn().mockReturnValue(true),
    } as unknown as LlmContextSnapshotService;
    const service = new LlmChatHostPortAdapterService(
      getDestroyRef(),
      appBus,
      new LlmCommandExtractionService(),
      llmContextSnapshotService,
      providerRegistryService,
    );
    service.threadMessages$.subscribe((messages) => {
      latestMessages = messages;
    });

    await service.sendPrompt("inspect containers");

    expect(latestMessages[1]).toMatchObject({
      text: ["Check this first:", "```sh llm:continue", "docker ps", "```"].join("\n"),
      isPending: false,
      isError: false,
    });
    expect(latestMessages[1].commands).toEqual([
      {
        command: "docker ps",
        language: "sh",
        executionMode: "run_and_continue",
        sourceMessageId: latestMessages[1].id,
        targetTerminalId: "terminal-1",
      },
    ]);
  });

  it("continues only for commands marked with run_and_continue", async () => {
    const providerAdapter = {
      type: "openai_compatible" as const,
      capabilities: { supportsStreaming: true },
      validateConfiguration: vi.fn().mockReturnValue([]),
      streamChat: vi.fn(async function* () {
        yield { text: "follow-up answer", done: true };
      }),
    };
    const providerRegistryService = {
      resolveActiveProvider: vi.fn().mockReturnValue({
        providerId: "provider-1",
        config: {
          type: "openai_compatible" as const,
          model: "gpt-test",
        },
        adapter: providerAdapter,
      }),
      validateActiveProvider: vi.fn().mockReturnValue([]),
    } as unknown as LlmProviderRegistryService;
    const llmContextSnapshotService = {
      captureFocusedTerminalContext: vi.fn().mockResolvedValue({
        terminalId: "terminal-1",
        isCommandRunning: false,
        commands: [],
      }),
      captureTerminalContext: vi.fn().mockResolvedValue({
        terminalId: "terminal-1",
        isCommandRunning: false,
        commands: [],
      }),
      hasTerminal: vi.fn().mockReturnValue(true),
    } as unknown as LlmContextSnapshotService;
    const service = new LlmChatHostPortAdapterService(
      getDestroyRef(),
      appBus,
      new LlmCommandExtractionService(),
      llmContextSnapshotService,
      providerRegistryService,
    );

    const publishSpy = vi.spyOn(appBus, "publish");

    await service.runCommandSuggestion({
      command: "echo final",
      executionMode: "run_only",
      sourceMessageId: "MSG1",
      targetTerminalId: "terminal-1",
    });

    expect(providerAdapter.streamChat).not.toHaveBeenCalled();
    expect(publishSpy).toHaveBeenCalledTimes(2);

    const continuePromise = service.runCommandSuggestion({
      command: "echo continue",
      executionMode: "run_and_continue",
      sourceMessageId: "MSG2",
      targetTerminalId: "terminal-1",
    });

    appBus.publish({
      path: ["app", "terminal"],
      type: "TerminalBusyChanged",
      payload: {
        terminalId: "terminal-1",
        isBusy: true,
      },
    } as any);
    appBus.publish({
      path: ["app", "terminal"],
      type: "TerminalBusyChanged",
      payload: {
        terminalId: "terminal-1",
        isBusy: false,
      },
    } as any);

    await continuePromise;

    expect(providerAdapter.streamChat).toHaveBeenCalledTimes(1);
  });
});

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
