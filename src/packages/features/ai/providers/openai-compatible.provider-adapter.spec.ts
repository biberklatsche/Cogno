import { HttpClientPort, HttpStreamEventContract } from "@cogno/core-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiChatRequest, AiProviderConfig, AiStreamChunk } from "../ai.models";
import { OpenAiCompatibleProviderAdapter } from "./openai-compatible.provider-adapter";

async function collectChunks(stream: AsyncIterable<AiStreamChunk>): Promise<AiStreamChunk[]> {
  const chunks: AiStreamChunk[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return chunks;
}

function createRequest(abortSignal?: AbortSignal): AiChatRequest {
  return {
    model: "gpt-test",
    messages: [{ role: "user", content: "hello" }],
    abortSignal,
  };
}

describe("OpenAiCompatibleProviderAdapter", () => {
  let httpClientPort: HttpClientPort;
  let adapter: OpenAiCompatibleProviderAdapter;

  beforeEach(() => {
    httpClientPort = {
      streamRequest: vi.fn(),
    };
    adapter = new OpenAiCompatibleProviderAdapter(httpClientPort);
  });

  it("validates required configuration fields", () => {
    expect(
      adapter.validateConfiguration("provider-1", {
        type: "openai_compatible",
      }),
    ).toEqual(["base_url is required.", "model is required."]);
  });

  it("streams sse chunks and marks completion", async () => {
    vi.mocked(httpClientPort.streamRequest).mockImplementation(
      async function* (): AsyncIterable<HttpStreamEventContract> {
        yield { type: "status", status: 200 };
        yield {
          type: "data",
          text: 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n',
        };
        yield {
          type: "data",
          text: 'data: {"choices":[{"delta":{"content":" world"},"finish_reason":"stop"}]}\n',
        };
        yield { type: "data", text: "data: [DONE]\n" };
        yield { type: "done" };
      },
    );

    const chunks = await collectChunks(
      adapter.streamChat(
        "provider-1",
        {
          type: "openai_compatible",
          base_url: "https://example.test",
          model: "gpt-test",
          api_key: "secret",
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
        url: "https://example.test/chat/completions",
        body: JSON.stringify({
          model: "gpt-test",
          messages: [{ role: "user", content: "hello" }],
          stream: true,
        }),
      }),
      undefined,
    );
  });

  it("falls back to plain json response bodies", async () => {
    vi.mocked(httpClientPort.streamRequest).mockImplementation(
      async function* (): AsyncIterable<HttpStreamEventContract> {
        yield { type: "status", status: 200 };
        yield {
          type: "data",
          text: '{"choices":[{"message":{"content":"single response"}}]}',
        };
        yield { type: "done" };
      },
    );

    const chunks = await collectChunks(
      adapter.streamChat(
        "provider-1",
        {
          type: "openai_compatible",
          base_url: "https://example.test",
          model: "gpt-test",
        },
        createRequest(),
      ),
    );

    expect(chunks).toEqual([{ text: "single response", done: true }]);
  });

  it("throws structured provider errors for non-success statuses", async () => {
    vi.mocked(httpClientPort.streamRequest).mockImplementation(
      async function* (): AsyncIterable<HttpStreamEventContract> {
        yield { type: "status", status: 401 };
        yield {
          type: "data",
          text: '{"error":{"message":"invalid api key"}}',
        };
        yield { type: "done" };
      },
    );

    await expect(
      collectChunks(
        adapter.streamChat(
          "provider-2",
          {
            type: "openai_compatible",
            base_url: "https://example.test",
            model: "gpt-test",
          },
          createRequest(),
        ),
      ),
    ).rejects.toMatchObject({
      message: "invalid api key",
      providerId: "provider-2",
      providerType: "openai_compatible",
      status: 401,
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
            type: "openai_compatible",
            base_url: "https://example.test",
            model: "gpt-test",
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
        yield { type: "data", text: 'data: {"choices":[{"delta":{"content":"x"}}]}\n' };
      },
    );

    await expect(
      collectChunks(
        adapter.streamChat(
          "provider-1",
          {
            type: "openai_compatible",
            base_url: "https://example.test",
            model: "gpt-test",
          },
          createRequest(controller.signal),
        ),
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
