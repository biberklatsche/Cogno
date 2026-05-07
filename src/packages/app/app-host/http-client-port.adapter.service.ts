import { Injectable } from "@angular/core";
import { AiHttp } from "@cogno/app-tauri/ai-http";
import {
  HttpClientPort,
  HttpRequestContract,
  HttpResponseContract,
  HttpStreamEvent,
} from "@cogno/core-api";

@Injectable({ providedIn: "root" })
export class HttpClientPortAdapterService extends HttpClientPort {
  async request(request: HttpRequestContract): Promise<HttpResponseContract> {
    return AiHttp.request({
      method: request.method,
      url: request.url,
      headers: request.headers ?? {},
      body: request.body ?? "",
      timeoutMs: request.timeoutMs,
    });
  }

  streamRequest(
    request: HttpRequestContract,
    abortSignal?: AbortSignal,
  ): AsyncIterable<HttpStreamEvent> {
    return AiHttp.streamRequest(
      {
        method: request.method,
        url: request.url,
        headers: request.headers ?? {},
        body: request.body ?? "",
        timeoutMs: request.timeoutMs,
      },
      abortSignal,
    );
  }
}
