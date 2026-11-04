import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { ActionHandlers } from "@cogno/core/workbench/actions/action-handlers";
import { ActionFired } from "@cogno/core/workbench/bus/action.models";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { TerminalBusyStateService } from "@cogno/core/workbench/terminal/terminal-busy-state.service";
import { WorkspaceHostApplicationService } from "@cogno/core/workbench/workspace/workspace-host-application.service";
import { Logger } from "@cogno/platform/logger";
import { AppWindow, QuitPhase } from "@cogno/platform/window";
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

    this.appWindow
      .answerQuitRequests((phase) => this.prepareQuit(phase))
      .pipe(takeUntilDestroyed(ref))
      .subscribe();

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

  /** Quits once every window agreed and saved; false when a user said no. */
  private async quit(): Promise<boolean> {
    try {
      return await this.appWindow.prepareQuit();
    } catch (error) {
      this.reportFailure("quit", "Could not quit Cogno", error);
      return false;
    }
  }

  /** Logs the error and tells the user in the header's words, once. */
  private reportFailure(action: string, header: string, error: unknown): void {
    ErrorReporter.reportException({
      error,
      handled: true,
      notify: false,
      source: "WindowService",
      context: { action },
    });
    this.bus.publish({
      type: "Notification",
      payload: {
        header,
        body: String(error),
        source: "Window",
        timestamp: new Date(),
        type: "error",
      },
    });
  }

  /** This window's part of a coordinated quit. */
  private async prepareQuit(phase: QuitPhase): Promise<boolean> {
    if (phase === "confirm") {
      if (this.terminalBusyStateService.hasBusyTerminals()) {
        // Best effort: a window that cannot come forward still asks.
        await this.appWindow
          .unminimize()
          .then(() => this.appWindow.setFocus())
          .catch((error) => Logger.warn(`Could not bring the window forward: ${String(error)}`));
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
      return true;
    } catch (error) {
      this.isClosing = false;
      this.reportFailure("close_window", "Could not close the window", error);
      return false;
    }
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
