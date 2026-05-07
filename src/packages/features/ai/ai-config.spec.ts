import { describe, expect, it } from "vitest";
import { getAiFeatureConfig, hasUsableAiProvider, resolveActiveProvider } from "./ai-config";

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
});
