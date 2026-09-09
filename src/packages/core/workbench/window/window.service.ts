import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { ActionHandlers } from "@cogno/core/workbench/actions/action-handlers";
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
    actions: ActionHandlers,
    ref: DestroyRef,
  ) {
    this.bus.publish({ type: "InitConfigCommand" });

    actions.handle("quit", () => this.quit());
    actions.handle("new_window", () => {
      this.windowCore.newWindow().catch((err) => {
        ErrorReporter.reportException({
          error: err,
          handled: true,
          source: "WindowService",
          context: { action: "new_window" },
        });
      });
    });
    actions.handle("close_window", () => this.closeWindow());
    actions.handle("minimize_window", () => {
      this.appWindow.minimize().then(() => Logger.debug("minimize window"));
    });

    this.appWindow.onCloseRequested$.pipe(takeUntilDestroyed(ref)).subscribe(async (evt) => {
      if (this.isClosing) return;
      evt.preventDefault();
      this.bus.publish(ActionFired.create("close_window", undefined, []));
    });
  }

  private async quit(): Promise<boolean> {
    if (
      !(await this.terminalBusyStateService.confirmProceedIfNoBusyTerminals("quit the application"))
    ) {
      return false;
    }
    await this.process.exit();
    return true;
  }

  private async closeWindow(): Promise<boolean> {
    if (
      !(await this.terminalBusyStateService.confirmProceedIfNoBusyTerminals(
        "close the application window",
      ))
    ) {
      return false;
    }
    this.isClosing = true;
    this.appWindow.close().then(() => Logger.debug("close window"));
    return true;
  }
}
