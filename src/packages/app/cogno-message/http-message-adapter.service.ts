import { DestroyRef, Injectable } from "@angular/core";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { HTTP_SERVER_DEFAULTS } from "@cogno/core/infrastructure/config/models/config";
import { CognoMessageListener } from "@cogno/platform/cogno-message";
import { HttpServer } from "@cogno/platform/http-server";
import { take } from "rxjs";
import { CognoMessageDispatcher } from "./cogno-message-dispatcher.service";

@Injectable({
  providedIn: "root",
})
export class HttpMessageAdapterService {
  constructor(
    private readonly httpServer: HttpServer,
    private readonly cognoMessages: CognoMessageListener,
    dispatcher: CognoMessageDispatcher,
    config: ConfigService,
    ref: DestroyRef,
  ) {
    config.config$.pipe(take(1)).subscribe((cfg) => {
      this.httpServer
        .start({
          enabled: cfg.http_server?.enabled ?? HTTP_SERVER_DEFAULTS.enabled,
          port: cfg.http_server?.port ?? HTTP_SERVER_DEFAULTS.port,
          autoNextPort: cfg.http_server?.auto_next_port ?? HTTP_SERVER_DEFAULTS.auto_next_port,
        })
        .then((port) => console.log(`[http-server] listening on port ${port}`))
        .catch((err) => console.error("[http-server] Failed to start:", err));
    });

    this.cognoMessages
      .register((message) => {
        dispatcher.dispatch(message);
      })
      .then((unlisten) => {
        ref.onDestroy(() => unlisten());
      });
  }
}
