import { describe, expect, it } from "vitest";
import { getAiFeatureConfig, hasUsableAiProvider, resolveActiveProvider } from "./ai-config";
import { mergeDetectedProviders } from "./ai-config.utils";
import type { DetectedAiProvider } from "./ai-detection.models";

describe("ai-config", () => {
  it("should resolve the active provider when configured", () => {
    const configuration = {
      ai: {
        active_provider: "local",
        providers: {
          local: {
            type: "ollama_native",
            base_url: "http://localhost:11434",
            model: "qwen3",
            enabled: true,
          },
        },
      },
    };

    expect(getAiFeatureConfig(configuration)?.active_provider).toBe("local");
    expect(resolveActiveProvider(configuration)).toEqual({
      providerId: "local",
      providerConfig: {
        type: "ollama_native",
        base_url: "http://localhost:11434",
        model: "qwen3",
        api_key: undefined,
        headers: undefined,
        enabled: true,
      },
    });
  });

  it("should report availability only for usable providers", () => {
    expect(
      hasUsableAiProvider({
        ai: {
          providers: {
            broken: {
              type: "openai_compatible",
              enabled: true,
            },
          },
        },
      }),
    ).toBe(false);

    expect(
      hasUsableAiProvider({
        ai: {
          providers: {
            local: {
              type: "openai_compatible",
              base_url: "http://localhost:1234/v1",
              model: "gpt-oss",
              enabled: true,
            },
          },
        },
      }),
    ).toBe(true);
  });

  it("should disable provider resolution when ai mode is off", () => {
    const configuration = {
      ai: {
        mode: "off",
        active_provider: "local",
        providers: {
          local: {
            type: "openai_compatible",
            base_url: "http://localhost:1234/v1",
            model: "gpt-oss",
            enabled: true,
          },
        },
      },
    };

    expect(hasUsableAiProvider(configuration)).toBe(false);
    expect(resolveActiveProvider(configuration)).toBeUndefined();
  });

  it("should treat auto mode as active — returns true when providers are configured", () => {
    expect(
      hasUsableAiProvider({
        ai: {
          mode: "auto",
          providers: {
            ollama: {
              type: "ollama_native",
              base_url: "http://localhost:11434",
              model: "llama3",
              enabled: true,
            },
          },
        },
      }),
    ).toBe(true);
  });
});

describe("mergeDetectedProviders", () => {
  const detectedOllama: DetectedAiProvider = {
    id: "ollama",
    displayName: "Ollama",
    type: "ollama_native",
    baseUrl: "http://localhost:11434",
    models: ["llama3", "mistral"],
  };

  it("adds detected provider to config using first model as default", () => {
    const config = { ai: { mode: "auto" } };
    const result = mergeDetectedProviders(config, [detectedOllama]);
    expect((result as Record<string, unknown>)["ai"]).toMatchObject({
      providers: {
        ollama: {
          type: "ollama_native",
          base_url: "http://localhost:11434",
          model: "llama3",
          enabled: true,
          auto_detected: true,
        },
      },
    });
  });

  it("does not overwrite provider already present in config", () => {
    const config = {
      ai: {
        providers: {
          ollama: { type: "ollama_native", base_url: "http://custom:11434", model: "qwen3", enabled: true },
        },
      },
    };
    const result = mergeDetectedProviders(config, [detectedOllama]) as Record<string, unknown>;
    const providers = ((result["ai"] as Record<string, unknown>)["providers"]) as Record<string, unknown>;
    expect((providers["ollama"] as Record<string, unknown>)["base_url"]).toBe("http://custom:11434");
    expect((providers["ollama"] as Record<string, unknown>)["model"]).toBe("qwen3");
  });

  it("returns the same config reference when no providers are detected", () => {
    const config = { ai: { mode: "auto" } };
    expect(mergeDetectedProviders(config, [])).toBe(config);
  });

  it("returns the same config reference when config has no ai section", () => {
    const config = { terminal: { font_size: 14 } };
    expect(mergeDetectedProviders(config, [detectedOllama])).toBe(config);
  });
});
