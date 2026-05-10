import { AiDetectableProviderDefinition } from "@cogno/features/ai/ai-detection.models";

const ollamaDetectableProvider: AiDetectableProviderDefinition = {
  id: "ollama",
  displayName: "Ollama",
  type: "ollama_native",
  defaultBaseUrl: "http://localhost:11434",
  probeEndpoint: "/api/tags",
  parseModels(body) {
    try {
      const parsed = JSON.parse(body) as { models?: Array<{ name?: string }> };
      return (parsed.models ?? []).map((m) => m.name ?? "").filter(Boolean);
    } catch {
      return [];
    }
  },
};

const lmStudioDetectableProvider: AiDetectableProviderDefinition = {
  id: "lmstudio",
  displayName: "LM Studio",
  type: "openai_compatible",
  defaultBaseUrl: "http://localhost:1234",
  probeEndpoint: "/v1/models",
  parseModels(body) {
    try {
      const parsed = JSON.parse(body) as { data?: Array<{ id?: string }> };
      return (parsed.data ?? []).map((m) => m.id ?? "").filter(Boolean);
    } catch {
      return [];
    }
  },
};

export const aiDetectableProviderDefinitions: readonly AiDetectableProviderDefinition[] = [
  ollamaDetectableProvider,
  lmStudioDetectableProvider,
];
