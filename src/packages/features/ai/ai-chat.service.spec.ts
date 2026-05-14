import type { DestroyRef } from "@angular/core";
import {
  ApplicationConfigurationPort,
  type TerminalBusyStateChangeContract,
  TerminalGateway,
} from "@cogno/core-api";
import { BehaviorSubject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiChatService } from "./ai-chat.service";
import { AiCommandExtractionService } from "./ai-command-extraction.service";
import { AiProviderRegistryService } from "./ai-provider-registry.service";
import { DetectedAiProvidersStore } from "./detected-ai-providers-store.service";

describe("AiChatService", () => {
  let applicationConfigurationPort: ApplicationConfigurationPort;
  let terminalGateway: TerminalGateway;
  let aiCommandExtractionService: AiCommandExtractionService;
  let aiProviderRegistryService: AiProviderRegistryService;
  let aiChatService: AiChatService;

  beforeEach(() => {
    const configurationSubject = new BehaviorSubject<Readonly<Record<string, unknown>>>({});
    const focusedTerminalIdSubject = new BehaviorSubject<string | undefined>(undefined);
    const busyStateChangesSubject = new BehaviorSubject<TerminalBusyStateChangeContract>({
      terminalId: "",
      isBusy: false,
    });

    applicationConfigurationPort = {
      configuration$: configurationSubject.asObservable(),
      getConfiguration: vi.fn().mockReturnValue({}),
    };
    terminalGateway = {
      focusedTerminalId$: focusedTerminalIdSubject.asObservable(),
      busyStateChanges$: busyStateChangesSubject.asObservable(),
      getFocusedTerminalId: vi.fn().mockReturnValue(undefined),
      hasTerminal: vi.fn().mockReturnValue(false),
      focusTerminal: vi.fn(),
      injectInput: vi.fn(),
      captureFocusedSnapshot: vi.fn().mockResolvedValue(undefined),
      captureSnapshot: vi.fn().mockResolvedValue(undefined),
    };
    aiCommandExtractionService = {
      parseAssistantResponse: vi.fn().mockReturnValue({
        displayText: "",
        commands: [],
      }),
      extractCommands: vi.fn().mockReturnValue([]),
    } as unknown as AiCommandExtractionService;
    aiProviderRegistryService = {
      resolveActiveProvider: vi.fn().mockReturnValue({
        providerId: "provider-1",
        config: {
          type: "openai_compatible",
          model: "gpt-test",
        },
        adapter: {
          type: "openai_compatible",
          capabilities: { supportsStreaming: true },
          validateConfiguration: vi.fn().mockReturnValue([]),
          streamChat: vi.fn().mockImplementation(async function* () {
            yield { text: "done", done: true };
          }),
        },
      }),
      validateActiveProvider: vi.fn().mockReturnValue([]),
      listEnabledProviderStatuses: vi.fn().mockReturnValue([]),
      selectActiveProvider: vi.fn().mockResolvedValue(undefined),
      selectActiveProviderWithModel: vi.fn(),
    } as unknown as AiProviderRegistryService;
    const destroyRef = {
      onDestroy: vi.fn(),
    } as unknown as DestroyRef;

    const aiDetectionStore = new DetectedAiProvidersStore();
    aiDetectionStore.setDetected([
      {
        id: "ollama",
        displayName: "Ollama",
        type: "ollama_native",
        baseUrl: "http://localhost:11434",
        models: ["llama3", "mistral"],
      },
    ]);

    aiChatService = new AiChatService(
      applicationConfigurationPort,
      terminalGateway,
      aiCommandExtractionService,
      aiProviderRegistryService,
      aiDetectionStore,
      destroyRef,
    );
  });

  it("clears the composer immediately when sending a prompt", async () => {
    aiChatService.updateComposerText("list files");

    const sendPromise = aiChatService.sendCurrentPrompt();

    expect(aiChatService.composerText()).toBe("");
    await sendPromise;
  });

  it("restores the composer text when sending fails", async () => {
    vi.mocked(aiProviderRegistryService.resolveActiveProvider).mockImplementation(() => {
      throw new Error("send failed");
    });
    aiChatService.updateComposerText("list files");

    await expect(aiChatService.sendCurrentPrompt()).rejects.toThrow("send failed");

    expect(aiChatService.composerText()).toBe("list files");
  });

  it("formats config-only provider as 'id (model)'", () => {
    expect(
      aiChatService.formatStatusMessage({
        providerId: "myapi",
        providerType: "openai_compatible",
        providerModel: "gpt-4o",
      }),
    ).toBe("myapi (gpt-4o)");
  });

  it("formats detected provider as 'model (displayName)'", () => {
    expect(
      aiChatService.formatStatusMessage({
        providerId: "ollama::llama3",
        providerType: "ollama_native",
        providerModel: "llama3",
      }),
    ).toBe("llama3 (Ollama)");
  });

  it("selectProvider with '::' calls selectActiveProviderWithModel", async () => {
    await aiChatService.selectProvider("ollama::mistral");
    expect(aiProviderRegistryService.selectActiveProviderWithModel).toHaveBeenCalledWith(
      "ollama",
      "mistral",
    );
    expect(aiProviderRegistryService.selectActiveProvider).not.toHaveBeenCalled();
  });

  it("selectProvider without '::' calls selectActiveProvider", async () => {
    await aiChatService.selectProvider("myapi");
    expect(aiProviderRegistryService.selectActiveProvider).toHaveBeenCalledWith("myapi");
    expect(aiProviderRegistryService.selectActiveProviderWithModel).not.toHaveBeenCalled();
  });
});
