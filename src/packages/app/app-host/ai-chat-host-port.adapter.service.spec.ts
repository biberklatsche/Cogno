import type { AiChatThreadMessageContract } from "@cogno/feature-api/ai/ai-chat.port";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDestroyRef } from "../../__test__/test-factory";
import { AppBus } from "../app-bus/app-bus";
import { AiChatHostPortAdapterService } from "./ai-chat-host-port.adapter.service";
import { AiCommandExtractionService } from "./ai-command-extraction.service";
import { AiContextSnapshotService } from "./ai-context-snapshot.service";
import { AiProviderRegistryService } from "./ai-provider-registry.service";

describe("AiChatHostPortAdapterService", () => {
  let appBus: AppBus;
  let latestMessages: ReadonlyArray<AiChatThreadMessageContract>;

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
      listEnabledProviderStatuses: vi.fn().mockReturnValue([
        {
          providerId: "provider-1",
          providerType: "openai_compatible",
          providerModel: "gpt-test",
        },
      ]),
      selectActiveProvider: vi.fn().mockResolvedValue(undefined),
    } as unknown as AiProviderRegistryService;
    const aiContextSnapshotService = {
      captureFocusedTerminalContext: vi.fn().mockResolvedValue({
        terminalId: "terminal-1",
        isCommandRunning: false,
        commands: [],
      }),
      captureTerminalContext: vi.fn(),
      hasTerminal: vi.fn().mockReturnValue(true),
      getFocusedTerminalId: vi.fn().mockReturnValue("terminal-1"),
    } as unknown as AiContextSnapshotService;
    const service = new AiChatHostPortAdapterService(
      getDestroyRef(),
      appBus,
      new AiCommandExtractionService(),
      aiContextSnapshotService,
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
          text: ["Check this first:", "```sh ai:continue", "docker ps", "```"].join("\n"),
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
      listEnabledProviderStatuses: vi.fn().mockReturnValue([
        {
          providerId: "provider-1",
          providerType: "openai_compatible",
          providerModel: "gpt-test",
        },
      ]),
      selectActiveProvider: vi.fn().mockResolvedValue(undefined),
    } as unknown as AiProviderRegistryService;
    const aiContextSnapshotService = {
      captureFocusedTerminalContext: vi.fn().mockResolvedValue({
        terminalId: "terminal-1",
        isCommandRunning: false,
        commands: [],
      }),
      captureTerminalContext: vi.fn(),
      hasTerminal: vi.fn().mockReturnValue(true),
      getFocusedTerminalId: vi.fn().mockReturnValue("terminal-1"),
    } as unknown as AiContextSnapshotService;
    const service = new AiChatHostPortAdapterService(
      getDestroyRef(),
      appBus,
      new AiCommandExtractionService(),
      aiContextSnapshotService,
      providerRegistryService,
    );
    service.threadMessages$.subscribe((messages) => {
      latestMessages = messages;
    });

    await service.sendPrompt("inspect containers");

    expect(latestMessages[1]).toMatchObject({
      text: ["Check this first:", "```sh ai:continue", "docker ps", "```"].join("\n"),
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
      listEnabledProviderStatuses: vi.fn().mockReturnValue([
        {
          providerId: "provider-1",
          providerType: "openai_compatible",
          providerModel: "gpt-test",
        },
      ]),
      selectActiveProvider: vi.fn().mockResolvedValue(undefined),
    } as unknown as AiProviderRegistryService;
    const aiContextSnapshotService = {
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
      getFocusedTerminalId: vi.fn().mockReturnValue("terminal-1"),
    } as unknown as AiContextSnapshotService;
    const service = new AiChatHostPortAdapterService(
      getDestroyRef(),
      appBus,
      new AiCommandExtractionService(),
      aiContextSnapshotService,
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

  it("tracks the focused terminal over the app bus", () => {
    const providerRegistryService = {
      resolveActiveProvider: vi.fn().mockReturnValue(undefined),
      validateActiveProvider: vi.fn().mockReturnValue([]),
      listEnabledProviderStatuses: vi.fn().mockReturnValue([]),
      selectActiveProvider: vi.fn().mockResolvedValue(undefined),
    } as unknown as AiProviderRegistryService;
    const aiContextSnapshotService = {
      captureFocusedTerminalContext: vi.fn(),
      captureTerminalContext: vi.fn(),
      hasTerminal: vi.fn().mockReturnValue(true),
      getFocusedTerminalId: vi.fn().mockReturnValue("terminal-2"),
    } as unknown as AiContextSnapshotService;
    const service = new AiChatHostPortAdapterService(
      getDestroyRef(),
      appBus,
      new AiCommandExtractionService(),
      aiContextSnapshotService,
      providerRegistryService,
    );
    const focusedTerminalIds: Array<string | undefined> = [];

    service.focusedTerminalId$.subscribe((focusedTerminalId) => {
      focusedTerminalIds.push(focusedTerminalId);
    });

    appBus.publish({
      path: ["app", "terminal"],
      type: "FocusTerminal",
      payload: "terminal-1",
    } as any);

    expect(focusedTerminalIds).toEqual(["terminal-2", "terminal-1"]);
  });

  it("focuses the target terminal when opening a command suggestion terminal", () => {
    const providerRegistryService = {
      resolveActiveProvider: vi.fn().mockReturnValue(undefined),
      validateActiveProvider: vi.fn().mockReturnValue([]),
      listEnabledProviderStatuses: vi.fn().mockReturnValue([]),
      selectActiveProvider: vi.fn().mockResolvedValue(undefined),
    } as unknown as AiProviderRegistryService;
    const aiContextSnapshotService = {
      captureFocusedTerminalContext: vi.fn(),
      captureTerminalContext: vi.fn(),
      hasTerminal: vi.fn().mockReturnValue(true),
      getFocusedTerminalId: vi.fn().mockReturnValue("terminal-2"),
    } as unknown as AiContextSnapshotService;
    const service = new AiChatHostPortAdapterService(
      getDestroyRef(),
      appBus,
      new AiCommandExtractionService(),
      aiContextSnapshotService,
      providerRegistryService,
    );
    const publishSpy = vi.spyOn(appBus, "publish");

    service.openCommandSuggestionTerminal({
      command: "pwd",
      sourceMessageId: "MSG1",
      targetTerminalId: "terminal-1",
    });

    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        path: ["app", "terminal"],
        type: "FocusTerminal",
        payload: "terminal-1",
      }),
    );
  });

  it("runs a command on the focused terminal even when the suggestion target terminal is unavailable", async () => {
    const providerRegistryService = {
      resolveActiveProvider: vi.fn().mockReturnValue({
        providerId: "provider-1",
        config: {
          type: "openai_compatible" as const,
          model: "gpt-test",
        },
        adapter: {
          type: "openai_compatible" as const,
          capabilities: { supportsStreaming: true },
          validateConfiguration: vi.fn().mockReturnValue([]),
          streamChat: vi.fn(),
        },
      }),
      validateActiveProvider: vi.fn().mockReturnValue([]),
      listEnabledProviderStatuses: vi.fn().mockReturnValue([
        {
          providerId: "provider-1",
          providerType: "openai_compatible",
          providerModel: "gpt-test",
        },
      ]),
      selectActiveProvider: vi.fn().mockResolvedValue(undefined),
    } as unknown as AiProviderRegistryService;
    const aiContextSnapshotService = {
      captureFocusedTerminalContext: vi.fn(),
      captureTerminalContext: vi.fn(),
      hasTerminal: vi.fn((terminalId?: string) => terminalId === "terminal-2"),
      getFocusedTerminalId: vi.fn().mockReturnValue("terminal-2"),
    } as unknown as AiContextSnapshotService;
    const service = new AiChatHostPortAdapterService(
      getDestroyRef(),
      appBus,
      new AiCommandExtractionService(),
      aiContextSnapshotService,
      providerRegistryService,
    );
    const publishSpy = vi.spyOn(appBus, "publish");

    expect(
      service.canApplyCommandSuggestion({
        command: "pwd",
        sourceMessageId: "MSG1",
        targetTerminalId: "terminal-1",
      }),
    ).toBe(true);

    await service.runCommandSuggestion({
      command: "pwd",
      executionMode: "run_only",
      sourceMessageId: "MSG1",
      targetTerminalId: "terminal-1",
    });

    expect(publishSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        path: ["app", "terminal"],
        type: "FocusTerminal",
        payload: "terminal-2",
      }),
    );
    expect(publishSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        path: ["app", "terminal"],
        type: "InjectTerminalInput",
        payload: expect.objectContaining({
          terminalId: "terminal-2",
          text: "pwd",
          appendNewline: true,
        }),
      }),
    );
  });

  it("exposes enabled provider statuses and delegates provider selection", async () => {
    const providerRegistryService = {
      resolveActiveProvider: vi.fn().mockReturnValue({
        providerId: "provider-2",
        config: {
          type: "ollama_native" as const,
          model: "llama3.1",
        },
        adapter: {
          type: "ollama_native" as const,
          capabilities: { supportsStreaming: true },
          validateConfiguration: vi.fn().mockReturnValue([]),
          streamChat: vi.fn(),
        },
      }),
      validateActiveProvider: vi.fn().mockReturnValue([]),
      listEnabledProviderStatuses: vi.fn().mockReturnValue([
        {
          providerId: "provider-1",
          providerType: "openai_compatible",
          providerModel: "gpt-4.1",
        },
        {
          providerId: "provider-2",
          providerType: "ollama_native",
          providerModel: "llama3.1",
        },
      ]),
      selectActiveProvider: vi.fn().mockResolvedValue(undefined),
    } as unknown as AiProviderRegistryService;
    const aiContextSnapshotService = {
      captureFocusedTerminalContext: vi.fn(),
      captureTerminalContext: vi.fn(),
      hasTerminal: vi.fn().mockReturnValue(true),
      getFocusedTerminalId: vi.fn().mockReturnValue("terminal-1"),
    } as unknown as AiContextSnapshotService;
    const service = new AiChatHostPortAdapterService(
      getDestroyRef(),
      appBus,
      new AiCommandExtractionService(),
      aiContextSnapshotService,
      providerRegistryService,
    );
    let providerStatuses: ReadonlyArray<any> = [];
    let providerStatus: any;

    service.providerStatuses$.subscribe((value) => {
      providerStatuses = value;
    });
    service.providerStatus$.subscribe((value) => {
      providerStatus = value;
    });

    expect(providerStatuses).toEqual([
      {
        providerId: "provider-1",
        providerType: "openai_compatible",
        providerModel: "gpt-4.1",
      },
      {
        providerId: "provider-2",
        providerType: "ollama_native",
        providerModel: "llama3.1",
      },
    ]);
    expect(providerStatus).toEqual({
      providerId: "provider-2",
      providerType: "ollama_native",
      providerModel: "llama3.1",
    });

    await service.selectProvider("provider-1");

    expect((providerRegistryService as any).selectActiveProvider).toHaveBeenCalledWith(
      "provider-1",
    );
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
