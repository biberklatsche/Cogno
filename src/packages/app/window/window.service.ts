import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Logger } from "@cogno/app-tauri/logger";
import { Process } from "@cogno/app-tauri/process";
import { AppWindow } from "@cogno/app-tauri/window";
import { WindowCore } from "@cogno/app-tauri/window-core";
import { ActionFired } from "../action/action.models";
import { AppBus } from "../app-bus/app-bus";
import { ErrorReporter } from "../common/error/error-reporter";
import { TerminalBusyStateService } from "../terminal/terminal-busy-state.service";

@Injectable({
  providedIn: "root",
})
export class WindowService {
  private isClosing = false;

  constructor(
    private readonly bus: AppBus,
    private readonly terminalBusyStateService: TerminalBusyStateService,
    ref: DestroyRef,
  ) {
    this.bus.publish({ type: "InitConfigCommand" });
    this.bus
      .on$({ path: ["app", "action"], type: "ActionFired" })
      .pipe(takeUntilDestroyed(ref))
      .subscribe(async (event) => {
        switch (event.payload) {
          case "quit":
            if (
              !(await this.terminalBusyStateService.confirmProceedIfNoBusyTerminals(
                "quit the application",
              ))
            ) {
              return;
            }
            await Process.exit();
            event.performed = true;
            break;
          case "new_window":
            WindowCore.newWindow().catch((err) => {
              ErrorReporter.reportException({
                error: err,
                handled: true,
                source: "WindowService",
                context: {
                  action: "new_window",
                },
              });
            });
            event.performed = true;
            break;
          case "close_window":
            if (event.args?.includes("workspace_saved")) {
              if (
                !(await this.terminalBusyStateService.confirmProceedIfNoBusyTerminals(
                  "close the application window",
                ))
              ) {
                return;
              }
              this.isClosing = true;
              AppWindow.close().then(() => Logger.debug("close window"));
              event.performed = true;
            }
            break;
        }
      });

    AppWindow.onCloseRequested$.pipe(takeUntilDestroyed(ref)).subscribe(async (evt) => {
      if (this.isClosing) return;
      evt.preventDefault();
      this.bus.publish(ActionFired.create("close_window", undefined, []));
    });
  }
}
