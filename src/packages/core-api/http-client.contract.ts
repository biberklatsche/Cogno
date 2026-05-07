export interface HttpRequestContract {
  readonly method: string;
  readonly url: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly timeoutMs?: number;
}

export interface HttpResponseContract {
  readonly status: number;
  readonly body: string;
}

export type HttpStreamEvent =
  | { readonly type: "status"; readonly status: number }
  | { readonly type: "data"; readonly text: string }
  | { readonly type: "done" }
  | { readonly type: "error"; readonly message: string };

export interface HttpClientPortContract {
  request(request: HttpRequestContract): Promise<HttpResponseContract>;
  streamRequest(request: HttpRequestContract, abortSignal?: AbortSignal): AsyncIterable<HttpStreamEvent>;
}

export abstract class HttpClientPort implements HttpClientPortContract {
  abstract request(request: HttpRequestContract): Promise<HttpResponseContract>;
  abstract streamRequest(request: HttpRequestContract, abortSignal?: AbortSignal): AsyncIterable<HttpStreamEvent>;
}
