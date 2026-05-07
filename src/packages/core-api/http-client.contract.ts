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

export interface HttpClientPortContract {
  request(request: HttpRequestContract): Promise<HttpResponseContract>;
}

export abstract class HttpClientPort implements HttpClientPortContract {
  abstract request(request: HttpRequestContract): Promise<HttpResponseContract>;
}
