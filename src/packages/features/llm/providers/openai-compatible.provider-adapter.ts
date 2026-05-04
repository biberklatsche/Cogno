import { Injectable } from "@angular/core";
import {
  LlmChatRequest,
  LlmProviderAdapter,
  LlmProviderConfig,
  LlmStreamChunk,
} from "../llm.models";
import {
  buildProviderUrl,
  createProviderHeaders,
  parseErrorResponse,
} from "./provider-fetch.utils";

type OpenAiStreamChunk = {
  choices?: ReadonlyArray<{
    delta?: {
      content?: string;
    };
    finish_reason?: string | null;
  }>;
};

@Injectable({ providedIn: "root" })
export class OpenAiCompatibleProviderAdapter implements LlmProviderAdapter {
  readonly type = "openai_compatible" as const;
  readonly capabilities = {
    supportsStreaming: true,
  } as const;

  validateConfiguration(_providerId: string, config: LlmProviderConfig): ReadonlyArray<string> {
    const validationErrors: string[] = [];
    if (!config.base_url) {
      validationErrors.push("base_url is required.");
    }
    if (!config.model) {
      validationErrors.push("model is required.");
    }
    return validationErrors;
  }

  async *streamChat(
    providerId: string,
    config: LlmProviderConfig,
    request: LlmChatRequest,
  ): AsyncIterable<LlmStreamChunk> {
    const response = await fetch(buildProviderUrl(config.base_url ?? "", "/chat/completions"), {
      method: "POST",
      headers: createProviderHeaders(config.api_key, config.headers),
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        stream: true,
      }),
      signal: request.abortSignal,
    });

    if (!response.ok) {
      throw createProviderError(
        providerId,
        this.type,
        response.status,
        await parseErrorResponse(response),
      );
    }

    if (!response.body) {
      const fallbackResponse = (await response.json()) as {
        choices?: ReadonlyArray<{ message?: { content?: string } }>;
      };
      const fallbackText = fallbackResponse.choices?.[0]?.message?.content ?? "";
      if (fallbackText) {
        yield { text: fallbackText, done: true };
        return;
      }
      throw createProviderError(providerId, this.type, response.status, "Empty response body.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pendingText = "";

    while (true) {
      const { done, value } = await reader.read();
      pendingText += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      const lines = pendingText.split(/\r?\n/);
      pendingText = lines.pop() ?? "";

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine.startsWith("data:")) {
          continue;
        }

        const payload = trimmedLine.slice(5).trim();
        if (!payload || payload === "[DONE]") {
          continue;
        }

        const parsedChunk = JSON.parse(payload) as OpenAiStreamChunk;
        const choice = parsedChunk.choices?.[0];
        const chunkText = choice?.delta?.content ?? "";
        if (chunkText) {
          yield { text: chunkText };
        }
        if (choice?.finish_reason) {
          yield { text: "", done: true };
        }
      }

      if (done) {
        break;
      }
    }

    if (pendingText.trim().length > 0 && pendingText.trim() !== "data: [DONE]") {
      const payload = pendingText.replace(/^data:\s*/, "").trim();
      if (payload && payload !== "[DONE]") {
        const parsedChunk = JSON.parse(payload) as OpenAiStreamChunk;
        const chunkText = parsedChunk.choices?.[0]?.delta?.content ?? "";
        if (chunkText) {
          yield { text: chunkText };
        }
      }
    }

    yield { text: "", done: true };
  }
}

function createProviderError(
  providerId: string,
  providerType: LlmProviderAdapter["type"],
  status: number | undefined,
  message: string,
): Error & { status?: number; providerId: string; providerType: LlmProviderAdapter["type"] } {
  const error = new Error(message) as Error & {
    status?: number;
    providerId: string;
    providerType: LlmProviderAdapter["type"];
  };
  error.status = status;
  error.providerId = providerId;
  error.providerType = providerType;
  return error;
}
