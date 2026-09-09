import { Injectable } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";

export interface HttpServerConfig {
  enabled: boolean;
  port: number;
  autoNextPort: boolean;
}

@Injectable({ providedIn: "root" })
export class HttpServer {
  start(config: HttpServerConfig): Promise<number> {
    return invoke<number>("start_http_server", {
      enabled: config.enabled,
      port: config.port,
      autoNextPort: config.autoNextPort,
    });
  }

  getPort(): Promise<number> {
    return invoke<number>("get_http_server_port");
  }

  /** Tell the backend which actions currently dispatch vs are inactive (step 26g). */
  setRunnableActions(
    dispatched: ReadonlyArray<string>,
    inactive: ReadonlyArray<string>,
  ): Promise<void> {
    return invoke<void>("set_runnable_actions", {
      dispatched: [...dispatched],
      inactive: [...inactive],
    });
  }
}
