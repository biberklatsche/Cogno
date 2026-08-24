import { Injectable } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type AiHttpRequestPayload = {
  method: string;
  url: string;
  headers: Readonly<Record<string, string>>;
  body: string;
  timeoutMs?: number;
};

export type AiHttpResponsePayload = {
  status: number;
  body: string;
};

export type AiHttpStreamEvent =
  | { readonly type: "status"; readonly status: number }
  | { readonly type: "data"; readonly text: string }
  | { readonly type: "done" }
  | { readonly type: "error"; readonly message: string };

export const AiHttp = {
  request(payload: AiHttpRequestPayload): Promise<AiHttpResponsePayload> {
    return invoke<AiHttpResponsePayload>("ai_http_request", { payload });
  },

  async *streamRequest(
    payload: AiHttpRequestPayload,
    abortSignal?: AbortSignal,
  ): AsyncIterable<AiHttpStreamEvent> {
    const streamId = crypto.randomUUID();
    const eventName = `ai-http-stream-${streamId}`;

    const queue: AiHttpStreamEvent[] = [];
    let notifyReady: (() => void) | null = null;

    const pushAndNotify = (event: AiHttpStreamEvent): void => {
      queue.push(event);
      const notify = notifyReady;
      notifyReady = null;
      notify?.();
    };

    const unlisten = await listen<AiHttpStreamEvent>(eventName, (e) => pushAndNotify(e.payload));

    abortSignal?.addEventListener("abort", () => pushAndNotify({ type: "done" }), { once: true });

    invoke<void>("ai_http_request_stream", { streamId, payload }).catch((err: unknown) => {
      pushAndNotify({ type: "error", message: String(err) });
    });

    try {
      while (!abortSignal?.aborted) {
        if (queue.length === 0) {
          await new Promise<void>((resolve) => {
            notifyReady = resolve;
          });
        }
        const event = queue.shift();
        if (!event) continue;
        if (abortSignal?.aborted && event.type === "done") break;
        yield event;
        if (event.type === "done" || event.type === "error") break;
      }
    } finally {
      unlisten();
    }
  },
};

export interface HttpRequestContract {
  readonly method: string;
  readonly url: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly timeoutMs?: number;
}

export type HttpResponseContract = AiHttpResponsePayload;
export type HttpStreamEvent = AiHttpStreamEvent;

/** HTTP through the Rust process, so requests are not subject to the webview's CORS rules. */
@Injectable({ providedIn: "root" })
export class HttpClient {
  request(request: HttpRequestContract): Promise<HttpResponseContract> {
    return AiHttp.request(toPayload(request));
  }

  streamRequest(
    request: HttpRequestContract,
    abortSignal?: AbortSignal,
  ): AsyncIterable<HttpStreamEvent> {
    return AiHttp.streamRequest(toPayload(request), abortSignal);
  }
}

function toPayload(request: HttpRequestContract): AiHttpRequestPayload {
  return {
    method: request.method,
    url: request.url,
    headers: request.headers ?? {},
    body: request.body ?? "",
    timeoutMs: request.timeoutMs,
  };
}
