import { Injectable } from "@angular/core";
import { HttpClientPort } from "@cogno/core-api";
import { AiChatRequest, AiProviderAdapter, AiProviderConfig, AiStreamChunk } from "../ai.models";
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
    let sawChunk = false;
    let collectedBody = "";

    for await (const event of this.httpClientPort.streamRequest(
      {
        method: "POST",
        url: buildProviderUrl(config.base_url ?? "", "/api/chat"),
        headers: headersToRecord(createProviderHeaders(undefined, config.headers)),
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

        if (status < 200 || status >= 300) {
          collectedBody += line + "\n";
          continue;
        }

        sawChunk = true;
        const parsedChunk = JSON.parse(line.trim()) as OllamaChatResponse;
        const chunkText = parsedChunk.message?.content ?? "";
        if (chunkText) yield { text: chunkText };
        if (parsedChunk.done) yield { text: "", done: true };
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
        if (!sawChunk) {
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
