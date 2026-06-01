import { invoke } from "@tauri-apps/api/core";

export interface HttpServerConfig {
  enabled: boolean;
  port: number;
  autoNextPort: boolean;
}

export const HttpServer = {
  start(config: HttpServerConfig): Promise<number> {
    return invoke<number>("start_http_server", {
      enabled: config.enabled,
      port: config.port,
      autoNextPort: config.autoNextPort,
    });
  },

  getPort(): Promise<number> {
    return invoke<number>("get_http_server_port");
  },
};
