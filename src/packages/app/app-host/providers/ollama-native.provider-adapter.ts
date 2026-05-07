import { Injectable } from "@angular/core";
import { AiHttp } from "@cogno/app-tauri/ai-http";
import {
  AiChatRequest,
  AiProviderAdapter,
  AiProviderConfig,
  AiStreamChunk,
} from "../ai-host.models";
import {
  buildProviderUrl,
  createProviderHeaders,
  headersToRecord,
  parseErrorResponseText,
} from "./provider-fetch.utils";

type OllamaChatResponse = {
  message?: {
    content?: string;
  };
  done?: boolean;
};

@Injectable({ providedIn: "root" })
export class OllamaNativeProviderAdapter implements AiProviderAdapter {
  readonly type = "ollama_native" as const;
  readonly capabilities = {
    supportsStreaming: true,
  } as const;

  validateConfiguration(_providerId: string, config: AiProviderConfig): ReadonlyArray<string> {
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
    config: AiProviderConfig,
    request: AiChatRequest,
  ): AsyncIterable<AiStreamChunk> {
    const response = await AiHttp.request({
      method: "POST",
      url: buildProviderUrl(config.base_url ?? "", "/api/chat"),
      headers: headersToRecord(createProviderHeaders(undefined, config.headers)),
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        stream: true,
      }),
    });

    if (request.abortSignal?.aborted) {
      throw createAbortError();
    }

    if (response.status < 200 || response.status >= 300) {
      throw createProviderError(
        providerId,
        this.type,
        response.status,
        parseErrorResponseText(response.body, response.status),
      );
    }

    let sawChunk = false;
    for (const line of response.body.split(/\r?\n/)) {
      if (request.abortSignal?.aborted) {
        throw createAbortError();
      }

      const trimmedLine = line.trim();
      if (!trimmedLine) {
        continue;
      }

      sawChunk = true;
      const parsedChunk = JSON.parse(trimmedLine) as OllamaChatResponse;
      const chunkText = parsedChunk.message?.content ?? "";
      if (chunkText) {
        yield { text: chunkText };
      }
      if (parsedChunk.done) {
        yield { text: "", done: true };
      }
    }

    if (!sawChunk) {
      const fallbackResponse = JSON.parse(response.body) as OllamaChatResponse;
      const fallbackText = fallbackResponse.message?.content ?? "";
      if (fallbackText) {
        yield { text: fallbackText, done: true };
        return;
      }
      throw createProviderError(providerId, this.type, response.status, "Empty response body.");
    }

    yield { text: "", done: true };
  }
}

function createProviderError(
  providerId: string,
  providerType: AiProviderAdapter["type"],
  status: number | undefined,
  message: string,
): Error & { status?: number; providerId: string; providerType: AiProviderAdapter["type"] } {
  const error = new Error(message) as Error & {
    status?: number;
    providerId: string;
    providerType: AiProviderAdapter["type"];
  };
  error.status = status;
  error.providerId = providerId;
  error.providerType = providerType;
  return error;
}

function createAbortError(): DOMException {
  return new DOMException("This operation was aborted", "AbortError");
}
