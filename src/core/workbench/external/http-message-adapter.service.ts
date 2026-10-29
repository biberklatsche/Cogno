import { DestroyRef, Injectable } from "@angular/core";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { Config } from "@cogno/core/infrastructure/config/models/config";
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
      // Present after every load: ConfigMapper merges the defaults under the
      // user file and replaces invalid values with them.
      const httpServer = cfg.http_server as Required<NonNullable<Config["http_server"]>>;
      this.httpServer
        .start({
          enabled: httpServer.enabled,
          port: httpServer.port,
          autoNextPort: httpServer.auto_next_port,
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
