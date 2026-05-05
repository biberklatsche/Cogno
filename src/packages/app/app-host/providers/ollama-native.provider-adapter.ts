import { Injectable } from "@angular/core";
import {
  LlmChatRequest,
  LlmProviderAdapter,
  LlmProviderConfig,
  LlmStreamChunk,
} from "../llm-host.models";
import {
  buildProviderUrl,
  createProviderHeaders,
  parseErrorResponse,
} from "./provider-fetch.utils";

type OllamaChatResponse = {
  message?: {
    content?: string;
  };
  done?: boolean;
};

@Injectable({ providedIn: "root" })
export class OllamaNativeProviderAdapter implements LlmProviderAdapter {
  readonly type = "ollama_native" as const;
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
    const response = await fetch(buildProviderUrl(config.base_url ?? "", "/api/chat"), {
      method: "POST",
      headers: createProviderHeaders(undefined, config.headers),
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
      const fallbackResponse = (await response.json()) as OllamaChatResponse;
      const fallbackText = fallbackResponse.message?.content ?? "";
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
        if (!trimmedLine) {
          continue;
        }
        const parsedChunk = JSON.parse(trimmedLine) as OllamaChatResponse;
        const chunkText = parsedChunk.message?.content ?? "";
        if (chunkText) {
          yield { text: chunkText };
        }
        if (parsedChunk.done) {
          yield { text: "", done: true };
        }
      }

      if (done) {
        break;
      }
    }

    if (pendingText.trim().length > 0) {
      const parsedChunk = JSON.parse(pendingText.trim()) as OllamaChatResponse;
      const chunkText = parsedChunk.message?.content ?? "";
      if (chunkText) {
        yield { text: chunkText };
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
