import { ApplicationConfigurationPort, HttpClientPort } from "@cogno/core-api";
import { Subject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiDetectableProviderDefinition } from "./ai-detection.models";
import { AiProviderDetectionService } from "./ai-provider-detection.service";
import { DetectedAiProvidersStore } from "./detected-ai-providers-store.service";

const ollamaDefinition: AiDetectableProviderDefinition = {
  id: "ollama",
  displayName: "Ollama",
  type: "ollama_native",
  defaultBaseUrl: "http://localhost:11434",
  probeEndpoint: "/api/tags",
  parseModels: (body) => {
    const parsed = JSON.parse(body) as { models?: Array<{ name: string }> };
    return (parsed.models ?? []).map((m) => m.name);
  },
};

const lmStudioDefinition: AiDetectableProviderDefinition = {
  id: "lmstudio",
  displayName: "LM Studio",
  type: "openai_compatible",
  defaultBaseUrl: "http://localhost:1234",
  probeEndpoint: "/v1/models",
  parseModels: (body) => {
    const parsed = JSON.parse(body) as { data?: Array<{ id: string }> };
    return (parsed.data ?? []).map((m) => m.id);
  },
};

describe("AiProviderDetectionService", () => {
  let configPort: ApplicationConfigurationPort;
  let httpClient: HttpClientPort;
  let store: DetectedAiProvidersStore;

  beforeEach(() => {
    configPort = {
      configuration$: new Subject(),
      getConfiguration: vi.fn().mockReturnValue({ feature: { ai: { mode: "visible" } } }),
    } as unknown as ApplicationConfigurationPort;

    httpClient = {
      request: vi.fn(),
      streamRequest: vi.fn(),
    } as unknown as HttpClientPort;

    store = new DetectedAiProvidersStore();
  });

  it("adds detected provider with all models when probe succeeds", async () => {
    vi.mocked(httpClient.request).mockResolvedValue({
      status: 200,
      body: JSON.stringify({ models: [{ name: "llama3" }, { name: "mistral" }] }),
    });

    const service = new AiProviderDetectionService(
      [ollamaDefinition],
      configPort,
      httpClient,
      store,
    );
    await service.detect();

    expect(store.detectedProviders()).toHaveLength(1);
    expect(store.detectedProviders()[0]).toMatchObject({
      id: "ollama",
      displayName: "Ollama",
      type: "ollama_native",
      baseUrl: "http://localhost:11434",
      models: ["llama3", "mistral"],
    });
  });

  it("skips provider when probe returns non-200", async () => {
    vi.mocked(httpClient.request).mockResolvedValue({ status: 503, body: "" });

    const service = new AiProviderDetectionService(
      [ollamaDefinition],
      configPort,
      httpClient,
      store,
    );
    await service.detect();

    expect(store.detectedProviders()).toHaveLength(0);
  });

  it("skips provider when network request throws", async () => {
    vi.mocked(httpClient.request).mockRejectedValue(new Error("ECONNREFUSED"));

    const service = new AiProviderDetectionService(
      [ollamaDefinition],
      configPort,
      httpClient,
      store,
    );
    await service.detect();

    expect(store.detectedProviders()).toHaveLength(0);
  });

  it("skips provider when probe returns no models", async () => {
    vi.mocked(httpClient.request).mockResolvedValue({
      status: 200,
      body: JSON.stringify({ models: [] }),
    });

    const service = new AiProviderDetectionService(
      [ollamaDefinition],
      configPort,
      httpClient,
      store,
    );
    await service.detect();

    expect(store.detectedProviders()).toHaveLength(0);
  });

  it("skips provider when user has explicitly disabled it in config", async () => {
    vi.mocked(configPort.getConfiguration).mockReturnValue({
      feature: { ai: { mode: "visible", providers: { ollama: { enabled: false } } } },
    });

    const service = new AiProviderDetectionService(
      [ollamaDefinition],
      configPort,
      httpClient,
      store,
    );
    await service.detect();

    expect(httpClient.request).not.toHaveBeenCalled();
    expect(store.detectedProviders()).toHaveLength(0);
  });

  it("uses user-configured base_url instead of default", async () => {
    vi.mocked(configPort.getConfiguration).mockReturnValue({
      feature: {
        ai: { mode: "visible", providers: { ollama: { base_url: "http://custom-host:11434" } } },
      },
    });
    vi.mocked(httpClient.request).mockResolvedValue({
      status: 200,
      body: JSON.stringify({ models: [{ name: "llama3" }] }),
    });

    const service = new AiProviderDetectionService(
      [ollamaDefinition],
      configPort,
      httpClient,
      store,
    );
    await service.detect();

    expect(httpClient.request).toHaveBeenCalledWith(
      expect.objectContaining({ url: "http://custom-host:11434/api/tags" }),
    );
    expect(store.detectedProviders()[0].baseUrl).toBe("http://custom-host:11434");
  });

  it("does not probe when ai mode is off", async () => {
    vi.mocked(configPort.getConfiguration).mockReturnValue({ feature: { ai: { mode: "off" } } });

    const service = new AiProviderDetectionService(
      [ollamaDefinition],
      configPort,
      httpClient,
      store,
    );
    await service.detect();

    expect(httpClient.request).not.toHaveBeenCalled();
  });

  it("probes all providers in parallel and collects only successful ones", async () => {
    vi.mocked(httpClient.request)
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce({
        status: 200,
        body: JSON.stringify({ data: [{ id: "mistral-7b" }] }),
      });

    const service = new AiProviderDetectionService(
      [ollamaDefinition, lmStudioDefinition],
      configPort,
      httpClient,
      store,
    );
    await service.detect();

    expect(store.detectedProviders()).toHaveLength(1);
    expect(store.detectedProviders()[0].id).toBe("lmstudio");
  });

  it("prevents concurrent detect() calls", async () => {
    let resolveRequest!: () => void;
    vi.mocked(httpClient.request).mockReturnValue(
      new Promise<{ status: number; body: string }>((resolve) => {
        resolveRequest = () =>
          resolve({ status: 200, body: JSON.stringify({ models: [{ name: "llama3" }] }) });
      }),
    );

    const service = new AiProviderDetectionService(
      [ollamaDefinition],
      configPort,
      httpClient,
      store,
    );

    const first = service.detect();
    const second = service.detect();
    resolveRequest();
    await Promise.all([first, second]);

    expect(httpClient.request).toHaveBeenCalledTimes(1);
  });

  it("tracks the detection state while probing providers", async () => {
    let resolveRequest!: (value: { status: number; body: string }) => void;
    vi.mocked(httpClient.request).mockReturnValue(
      new Promise<{ status: number; body: string }>((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const service = new AiProviderDetectionService(
      [ollamaDefinition],
      configPort,
      httpClient,
      store,
    );

    const detectionPromise = service.detect();
    expect(store.isDetecting()).toBe(true);

    resolveRequest({
      status: 200,
      body: JSON.stringify({ models: [{ name: "llama3" }] }),
    });
    await detectionPromise;

    expect(store.isDetecting()).toBe(false);
    expect(store.detectedProviders()).toHaveLength(1);
  });
});
