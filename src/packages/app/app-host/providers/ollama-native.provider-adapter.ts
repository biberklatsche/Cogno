import { Injectable } from "@angular/core";
import {
  LlmChatCompletion,
  LlmChatRequest,
  LlmProviderAdapter,
  LlmProviderConfig,
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
};

@Injectable({ providedIn: "root" })
export class OllamaNativeProviderAdapter implements LlmProviderAdapter {
  readonly type = "ollama_native" as const;

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

  async completeChat(
    providerId: string,
    config: LlmProviderConfig,
    request: LlmChatRequest,
  ): Promise<LlmChatCompletion> {
    const response = await fetch(buildProviderUrl(config.base_url ?? "", "/api/chat"), {
      method: "POST",
      headers: createProviderHeaders(undefined, config.headers),
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        stream: false,
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

    const parsedResponse = (await response.json()) as OllamaChatResponse;
    const message = parsedResponse.message;
    return {
      text: message?.content ?? "",
    };
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
