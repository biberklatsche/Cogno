import { Injectable } from "@angular/core";
import { HttpClientPort } from "@cogno/core-api";
import { AiChatRequest, AiProviderAdapter, AiProviderConfig, AiStreamChunk } from "../ai.models";
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

  constructor(private readonly httpClientPort: HttpClientPort) {}

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
    if (request.abortSignal?.aborted) throw createAbortError();

    let status = 200;
    let lineBuffer = "";
    let streamingMode: "sse" | "json" | "unknown" = "unknown";
    let collectedBody = "";

    for await (const event of this.httpClientPort.streamRequest(
      {
        method: "POST",
        url: buildProviderUrl(config.base_url ?? "", "/chat/completions"),
        headers: headersToRecord(createProviderHeaders(config.api_key, config.headers)),
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          stream: true,
        }),
      },
      request.abortSignal,
    )) {
      if (request.abortSignal?.aborted) throw createAbortError();
      if (event.type === "error") throw new Error(event.message);
      if (event.type === "status") {
        status = event.status;
        continue;
      }
      if (event.type === "data") lineBuffer += event.text;

      const isDone = event.type === "done";

      while (lineBuffer.length > 0) {
        const newlineIdx = lineBuffer.indexOf("\n");
        if (newlineIdx === -1 && !isDone) break;
        const endIdx = newlineIdx !== -1 ? newlineIdx : lineBuffer.length;
        const line = lineBuffer.slice(0, endIdx).replace(/\r$/, "");
        lineBuffer = newlineIdx !== -1 ? lineBuffer.slice(newlineIdx + 1) : "";

        if (!line.trim()) continue;

        if (streamingMode === "unknown") {
          streamingMode = line.trim().startsWith("{") ? "json" : "sse";
        }

        if (status < 200 || status >= 300 || streamingMode === "json") {
          collectedBody += line + "\n";
          continue;
        }

        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;

        const parsedChunk = JSON.parse(payload) as OpenAiChatResponse;
        const choice = parsedChunk.choices?.[0];
        const chunkText = choice?.delta?.content ?? "";
        if (chunkText) yield { text: chunkText };
        if (choice?.finish_reason) yield { text: "", done: true };
      }

      if (isDone) {
        if (status < 200 || status >= 300) {
          throw createProviderError(
            providerId,
            this.type,
            status,
            parseErrorResponseText(collectedBody, status),
          );
        }
        if (streamingMode === "json") {
          const fallback = JSON.parse(collectedBody.trim()) as {
            choices?: ReadonlyArray<{ message?: { content?: string | null } }>;
          };
          const text = fallback.choices?.[0]?.message?.content ?? "";
          if (text) {
            yield { text, done: true };
            return;
          }
          throw createProviderError(providerId, this.type, status, "Empty response body.");
        }
        break;
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
