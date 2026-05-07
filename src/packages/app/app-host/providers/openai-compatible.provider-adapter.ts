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

type OpenAiChatResponse = {
  choices?: ReadonlyArray<{
    delta?: {
      content?: string;
    };
    finish_reason?: string | null;
  }>;
};

@Injectable({ providedIn: "root" })
export class OpenAiCompatibleProviderAdapter implements AiProviderAdapter {
  readonly type = "openai_compatible" as const;
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
      url: buildProviderUrl(config.base_url ?? "", "/chat/completions"),
      headers: headersToRecord(createProviderHeaders(config.api_key, config.headers)),
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

    const trimmedBody = response.body.trim();
    if (trimmedBody.startsWith("{")) {
      const fallbackResponse = JSON.parse(trimmedBody) as {
        choices?: ReadonlyArray<{ message?: { content?: string | null } }>;
      };
      const fallbackText = fallbackResponse.choices?.[0]?.message?.content ?? "";
      if (fallbackText) {
        yield { text: fallbackText, done: true };
        return;
      }
      throw createProviderError(providerId, this.type, response.status, "Empty response body.");
    }

    for (const line of response.body.split(/\r?\n/)) {
      if (request.abortSignal?.aborted) {
        throw createAbortError();
      }

      const trimmedLine = line.trim();
      if (!trimmedLine.startsWith("data:")) {
        continue;
      }

      const payload = trimmedLine.slice(5).trim();
      if (!payload || payload === "[DONE]") {
        continue;
      }

      const parsedChunk = JSON.parse(payload) as OpenAiChatResponse;
      const choice = parsedChunk.choices?.[0];
      const chunkText = choice?.delta?.content ?? "";
      if (chunkText) {
        yield { text: chunkText };
      }
      if (choice?.finish_reason) {
        yield { text: "", done: true };
      }
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
