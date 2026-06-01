import { DestroyRef, Injectable } from "@angular/core";
import { CognoMessageListener } from "@cogno/app-tauri/cogno-message";
import { HttpServer } from "@cogno/app-tauri/http-server";
import { HTTP_SERVER_DEFAULTS } from "../config/+models/config";
import { ConfigService } from "../config/+state/config.service";
import { take } from "rxjs";
import { CognoMessageDispatcher } from "./cogno-message-dispatcher.service";

@Injectable({
  providedIn: "root",
})
export class HttpMessageAdapterService {
  constructor(dispatcher: CognoMessageDispatcher, config: ConfigService, ref: DestroyRef) {
    config.config$.pipe(take(1)).subscribe((cfg) => {
      HttpServer.start({
        enabled: cfg.http_server?.enabled ?? HTTP_SERVER_DEFAULTS.enabled,
        port: cfg.http_server?.port ?? HTTP_SERVER_DEFAULTS.port,
        autoNextPort: cfg.http_server?.auto_next_port ?? HTTP_SERVER_DEFAULTS.auto_next_port,
      }).catch((err) => console.error("[http-server] Failed to start:", err));
    });

    CognoMessageListener.register((message) => {
      dispatcher.dispatch(message);
    }).then((unlisten) => {
      ref.onDestroy(() => unlisten());
    });
  }
}
