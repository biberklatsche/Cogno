import { ApplicationConfigurationPort } from "@cogno/core-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiProviderAdapter } from "./ai.models";
import { AiProviderRegistryService } from "./ai-provider-registry.service";

function createAdapter(type: AiProviderAdapter["type"]): AiProviderAdapter {
  return {
    type,
    capabilities: { supportsStreaming: true },
    validateConfiguration: vi.fn().mockReturnValue([]),
    streamChat: vi.fn(),
  };
}

describe("AiProviderRegistryService", () => {
  let applicationConfigurationPort: ApplicationConfigurationPort;
  let openAiCompatibleProviderAdapter: AiProviderAdapter;
  let ollamaNativeProviderAdapter: AiProviderAdapter;
  let service: AiProviderRegistryService;

  beforeEach(() => {
    applicationConfigurationPort = {
      configuration$: { subscribe: vi.fn() },
      getConfiguration: vi.fn().mockReturnValue({
        ai: {
          mode: "visible",
          active_provider: "openai",
          providers: {
            openai: {
              type: "openai_compatible",
              base_url: "https://example.test",
              model: "gpt-test",
              enabled: true,
            },
            ollama: {
              type: "ollama_native",
              base_url: "http://localhost:11434",
              model: "llama3",
              enabled: true,
            },
            disabled: {
              type: "openai_compatible",
              base_url: "https://disabled.test",
              model: "gpt-disabled",
              enabled: false,
            },
          },
        },
      }),
    };
    openAiCompatibleProviderAdapter = createAdapter("openai_compatible");
    ollamaNativeProviderAdapter = createAdapter("ollama_native");
    service = new AiProviderRegistryService(
      applicationConfigurationPort,
      openAiCompatibleProviderAdapter as never,
      ollamaNativeProviderAdapter as never,
    );
  });

  it("resolves the configured active provider", () => {
    expect(service.resolveActiveProvider()).toEqual({
      providerId: "openai",
      config: {
        type: "openai_compatible",
        base_url: "https://example.test",
        model: "gpt-test",
        enabled: true,
      },
      adapter: openAiCompatibleProviderAdapter,
    });
  });

  it("falls back to the selected provider when it is valid", async () => {
    await service.selectActiveProvider("ollama");

    expect(service.resolveActiveProvider()).toEqual({
      providerId: "ollama",
      config: {
        type: "ollama_native",
        base_url: "http://localhost:11434",
        model: "llama3",
        enabled: true,
      },
      adapter: ollamaNativeProviderAdapter,
    });
  });

  it("returns validation errors for missing config or unsupported adapter types", () => {
    vi.mocked(applicationConfigurationPort.getConfiguration).mockReturnValue(undefined);
    expect(service.validateActiveProvider()).toEqual(["Config is not loaded yet."]);

    vi.mocked(applicationConfigurationPort.getConfiguration).mockReturnValue({
      ai: {
        mode: "visible",
        active_provider: "custom",
        providers: {
          custom: {
            type: "openai_compatible",
            base_url: "https://custom.test",
            model: "gpt-custom",
          },
        },
      },
    });
    const unsupportedRegistry = new AiProviderRegistryService(
      applicationConfigurationPort,
      createAdapter("ollama_native") as never,
      createAdapter("ollama_native") as never,
    );

    expect(unsupportedRegistry.validateActiveProvider()).toEqual([
      "Unsupported provider type: openai_compatible",
    ]);
  });

  it("delegates provider-specific validation for the active adapter", () => {
    vi.mocked(openAiCompatibleProviderAdapter.validateConfiguration).mockReturnValue([
      "api_key is required.",
    ]);

    expect(service.validateActiveProvider()).toEqual(["api_key is required."]);
    expect(openAiCompatibleProviderAdapter.validateConfiguration).toHaveBeenCalledWith("openai", {
      type: "openai_compatible",
      base_url: "https://example.test",
      model: "gpt-test",
      enabled: true,
    });
  });

  it("lists enabled and usable provider statuses only", () => {
    expect(service.listEnabledProviderStatuses()).toEqual([
      {
        providerId: "openai",
        providerType: "openai_compatible",
        providerModel: "gpt-test",
      },
      {
        providerId: "ollama",
        providerType: "ollama_native",
        providerModel: "llama3",
      },
    ]);
  });

  it("ignores invalid selections and disabled ai modes", async () => {
    await service.selectActiveProvider("missing");
    expect(service.resolveActiveProvider()?.providerId).toBe("openai");

    vi.mocked(applicationConfigurationPort.getConfiguration).mockReturnValue({
      ai: {
        mode: "off",
        providers: {
          openai: {
            type: "openai_compatible",
            base_url: "https://example.test",
            model: "gpt-test",
          },
        },
      },
    });

    expect(service.resolveActiveProvider()).toBeUndefined();
    expect(service.listEnabledProviderStatuses()).toEqual([]);
  });
});
