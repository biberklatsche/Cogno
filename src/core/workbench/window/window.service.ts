import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { ActionHandlers } from "@cogno/core/workbench/actions/action-handlers";
import { ActionFired } from "@cogno/core/workbench/bus/action.models";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { TerminalBusyStateService } from "@cogno/core/workbench/terminal/terminal-busy-state.service";
import { WorkspaceHostApplicationService } from "@cogno/core/workbench/workspace/workspace-host-application.service";
import { Logger } from "@cogno/platform/logger";
import { AppWindow } from "@cogno/platform/window";
import { WindowCore } from "@cogno/platform/window-core";

/** Max time the quit/close path waits for the session auto-save. */
const SESSION_PERSIST_BUDGET_MS = 3000;

@Injectable({
  providedIn: "root",
})
export class WindowService {
  private isClosing = false;

  constructor(
    private readonly appWindow: AppWindow,
    private readonly windowCore: WindowCore,
    private readonly bus: AppBus,
    private readonly terminalBusyStateService: TerminalBusyStateService,
    private readonly workspaceHost: WorkspaceHostApplicationService,
    actions: ActionHandlers,
    ref: DestroyRef,
  ) {
    this.bus.publish({ type: "InitConfigCommand" });

    this.appWindow.prepareQuit$.pipe(takeUntilDestroyed(ref)).subscribe((request) => {
      void this.prepareQuit(request.phase)
        .then(
          (accepted) => this.appWindow.answerQuit(request.requestId, accepted),
          (error) => this.appWindow.answerQuit(request.requestId, false, String(error)),
        )
        .catch((error) =>
          ErrorReporter.reportException({
            error,
            handled: true,
            source: "WindowService",
            context: { action: "prepare_quit" },
          }),
        );
    });

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
    try {
      return await this.appWindow.prepareQuit();
    } catch (error) {
      ErrorReporter.reportException({
        error,
        handled: true,
        source: "WindowService",
        context: { action: "quit" },
      });
      this.bus.publish({
        type: "Notification",
        payload: {
          header: "Could not quit Cogno",
          body: String(error),
          source: "Window",
          timestamp: new Date(),
          type: "error",
        },
      });
      return false;
    }
  }

  private async prepareQuit(phase: "confirm" | "persist"): Promise<boolean> {
    if (phase === "confirm") {
      if (this.terminalBusyStateService.hasBusyTerminals()) {
        await this.appWindow.unminimize();
        await this.appWindow.setFocus();
      }
      return this.terminalBusyStateService.confirmProceedIfNoBusyTerminals("quit the application");
    }
    await this.persistSessionWithinBudget();
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
    try {
      await this.appWindow.close();
      Logger.debug("close window");
    } catch (error) {
      this.isClosing = false;
      throw error;
    }
    return true;
  }

  /**
   * Auto-save the active workspace before quitting/closing, but never hang the
   * exit: a time budget wins the race, so a pathologically slow serialization
   * loses at most the scrollback rather than blocking.
   */
  private async persistSessionWithinBudget(): Promise<void> {
    const budget = new Promise<void>((resolve) => setTimeout(resolve, SESSION_PERSIST_BUDGET_MS));
    const shutdownWork = Promise.all([
      this.workspaceHost.persistOpenWorkspaces(),
      // A command still running now is being killed; record it as aborted.
      this.workspaceHost.recordAbortedCommands(),
    ]);
    await Promise.race([shutdownWork, budget]);
  }
}
