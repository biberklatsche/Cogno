import { HttpClientPort, HttpStreamEventContract } from "@cogno/core-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiChatRequest, AiProviderConfig, AiStreamChunk } from "../ai.models";
import { OllamaNativeProviderAdapter } from "./ollama-native.provider-adapter";

async function collectChunks(stream: AsyncIterable<AiStreamChunk>): Promise<AiStreamChunk[]> {
  const chunks: AiStreamChunk[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return chunks;
}

function createRequest(abortSignal?: AbortSignal): AiChatRequest {
  return {
    model: "llama3",
    messages: [{ role: "user", content: "hello" }],
    abortSignal,
  };
}

describe("OllamaNativeProviderAdapter", () => {
  let httpClientPort: HttpClientPort;
  let adapter: OllamaNativeProviderAdapter;

  beforeEach(() => {
    httpClientPort = {
      streamRequest: vi.fn(),
    };
    adapter = new OllamaNativeProviderAdapter(httpClientPort);
  });

  it("validates required configuration fields", () => {
    expect(
      adapter.validateConfiguration("provider-1", {
        type: "ollama_native",
      }),
    ).toEqual(["base_url is required.", "model is required."]);
  });

  it("streams ndjson chunks and marks completion", async () => {
    vi.mocked(httpClientPort.streamRequest).mockImplementation(
      async function* (): AsyncIterable<HttpStreamEventContract> {
        yield { type: "status", status: 200 };
        yield {
          type: "data",
          text: '{"message":{"content":"Hello"}}\n{"message":{"content":" world"},"done":true}\n',
        };
        yield { type: "done" };
      },
    );

    const chunks = await collectChunks(
      adapter.streamChat(
        "provider-1",
        {
          type: "ollama_native",
          base_url: "http://localhost:11434",
          model: "llama3",
        } satisfies AiProviderConfig,
        createRequest(),
      ),
    );

    expect(chunks).toEqual([
      { text: "Hello" },
      { text: " world" },
      { text: "", done: true },
      { text: "", done: true },
    ]);
    expect(httpClientPort.streamRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: "http://localhost:11434/api/chat",
      }),
      undefined,
    );
  });

  it("throws provider errors for non-success statuses", async () => {
    vi.mocked(httpClientPort.streamRequest).mockImplementation(
      async function* (): AsyncIterable<HttpStreamEventContract> {
        yield { type: "status", status: 500 };
        yield { type: "data", text: '{"error":"backend failed"}' };
        yield { type: "done" };
      },
    );

    await expect(
      collectChunks(
        adapter.streamChat(
          "provider-2",
          {
            type: "ollama_native",
            base_url: "http://localhost:11434",
            model: "llama3",
          },
          createRequest(),
        ),
      ),
    ).rejects.toMatchObject({
      message: "backend failed",
      providerId: "provider-2",
      providerType: "ollama_native",
      status: 500,
    });
  });

  it("throws when the backend returns no chunks", async () => {
    vi.mocked(httpClientPort.streamRequest).mockImplementation(
      async function* (): AsyncIterable<HttpStreamEventContract> {
        yield { type: "status", status: 200 };
        yield { type: "done" };
      },
    );

    await expect(
      collectChunks(
        adapter.streamChat(
          "provider-3",
          {
            type: "ollama_native",
            base_url: "http://localhost:11434",
            model: "llama3",
          },
          createRequest(),
        ),
      ),
    ).rejects.toMatchObject({
      message: "Empty response body.",
    });
  });

  it("throws abort errors before starting or while streaming", async () => {
    const abortedController = new AbortController();
    abortedController.abort();

    await expect(
      collectChunks(
        adapter.streamChat(
          "provider-1",
          {
            type: "ollama_native",
            base_url: "http://localhost:11434",
            model: "llama3",
          },
          createRequest(abortedController.signal),
        ),
      ),
    ).rejects.toMatchObject({ name: "AbortError" });

    const controller = new AbortController();
    vi.mocked(httpClientPort.streamRequest).mockImplementation(
      async function* (): AsyncIterable<HttpStreamEventContract> {
        yield { type: "status", status: 200 };
        controller.abort();
        yield { type: "data", text: '{"message":{"content":"x"}}\n' };
      },
    );

    await expect(
      collectChunks(
        adapter.streamChat(
          "provider-1",
          {
            type: "ollama_native",
            base_url: "http://localhost:11434",
            model: "llama3",
          },
          createRequest(controller.signal),
        ),
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
