import { invoke } from "@tauri-apps/api/core";

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

export const AiHttp = {
  request(payload: AiHttpRequestPayload): Promise<AiHttpResponsePayload> {
    return invoke<AiHttpResponsePayload>("ai_http_request", { payload });
  },
};
