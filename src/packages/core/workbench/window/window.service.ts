import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { ActionHandlers } from "@cogno/core/workbench/actions/action-handlers";
import { ActionFired } from "@cogno/core/workbench/bus/action.models";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { TerminalBusyStateService } from "@cogno/core/workbench/terminal/terminal-busy-state.service";
import { WorkspaceHostApplicationService } from "@cogno/core/workbench/workspace/workspace-host-application.service";
import { Logger } from "@cogno/platform/logger";
import { Process } from "@cogno/platform/process";
import { AppWindow } from "@cogno/platform/window";
import { WindowCore } from "@cogno/platform/window-core";

/** Max time the quit/close path waits for the session auto-save (step 27e). */
const SESSION_PERSIST_BUDGET_MS = 3000;

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
    private readonly workspaceHost: WorkspaceHostApplicationService,
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
    await this.persistSessionWithinBudget();
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
    await this.persistSessionWithinBudget();
    this.isClosing = true;
    this.appWindow.close().then(() => Logger.debug("close window"));
    return true;
  }

  /**
   * Auto-save the active workspace before quitting/closing, but never hang the
   * exit: a time budget wins the race, so a pathologically slow serialization
   * loses at most the scrollback rather than blocking (step 27e).
   */
  private async persistSessionWithinBudget(): Promise<void> {
    const budget = new Promise<void>((resolve) => setTimeout(resolve, SESSION_PERSIST_BUDGET_MS));
    const shutdownWork = Promise.all([
      this.workspaceHost.persistActiveWorkspace(),
      // A command still running now is being killed; record it as aborted (27b-2).
      this.workspaceHost.recordAbortedCommands(),
    ]);
    await Promise.race([shutdownWork, budget]);
  }
}
