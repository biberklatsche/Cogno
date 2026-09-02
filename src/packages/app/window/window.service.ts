import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { ActionFired } from "@cogno/core/workbench/bus/action.models";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { TerminalBusyStateService } from "@cogno/core/workbench/terminal/terminal-busy-state.service";
import { Logger } from "@cogno/platform/logger";
import { Process } from "@cogno/platform/process";
import { AppWindow } from "@cogno/platform/window";
import { WindowCore } from "@cogno/platform/window-core";

@Injectable({
  providedIn: "root",
})
export class WindowService {
  private isClosing = false;

  constructor(
    private readonly appWindow: AppWindow,
    private readonly windowCore: WindowCore,
    private readonly process: Process,
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
            await this.process.exit();
            event.performed = true;
            break;
          case "new_window":
            this.windowCore.newWindow().catch((err) => {
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
            if (
              !(await this.terminalBusyStateService.confirmProceedIfNoBusyTerminals(
                "close the application window",
              ))
            ) {
              return;
            }
            this.isClosing = true;
            this.appWindow.close().then(() => Logger.debug("close window"));
            event.performed = true;
            break;
        }
      });

    this.appWindow.onCloseRequested$.pipe(takeUntilDestroyed(ref)).subscribe(async (evt) => {
      if (this.isClosing) return;
      evt.preventDefault();
      this.bus.publish(ActionFired.create("close_window", undefined, []));
    });
  }
}
