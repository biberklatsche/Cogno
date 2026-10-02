import { DestroyRef, Injectable } from "@angular/core";
import { TerminalNavigator } from "@cogno/core/api/terminal-navigator-port";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { GridListService } from "@cogno/core/workbench/grid-list/+state/grid-list.service";
import { WorkspaceHostApplicationService } from "@cogno/core/workbench/workspace/workspace-host-application.service";
import { Subscription } from "rxjs";

export interface NotificationTargetRuntime {
  readonly workspaceId: string;
  readonly tabId: string;
  readonly terminalId?: string;
}

@Injectable({ providedIn: "root" })
export class NotificationTargetRuntimeService {
  constructor(
    private readonly appBus: AppBus,
    private readonly gridListService: GridListService,
    private readonly workspaces: WorkspaceHostApplicationService,
    private readonly navigator: TerminalNavigator,
    destroyRef: DestroyRef,
  ) {
    const subscription = new Subscription();
    subscription.add(
      this.appBus.on$("OpenNotificationTarget").subscribe((event) => {
        void this.openTarget(event.payload);
      }),
    );
    destroyRef.onDestroy(() => {
      subscription.unsubscribe();
    });
  }

  /**
   * A notification about a terminal goes to that terminal wherever it is now -
   * it may have moved to another tab since. A target without a terminal opens
   * its tab.
   */
  async openTarget(target: NotificationTargetRuntime | undefined): Promise<void> {
    if (!target) {
      return;
    }

    if (target.terminalId) {
      if (!this.gridListService.findTabIdByTerminalId(target.terminalId)) {
        this.publishUnavailableTargetNotification();
        return;
      }
      await this.navigator.navigateToTerminal(target.terminalId);
      return;
    }

    await this.workspaces.restoreWorkspaceById(target.workspaceId);
    const tabExists = this.gridListService
      .getGridConfigs(target.workspaceId)
      .some((gridConfig) => gridConfig.tabId === target.tabId);
    if (!tabExists) {
      this.publishUnavailableTargetNotification();
      return;
    }

    this.appBus.publish({
      type: "SelectTab",
      payload: target.tabId,
    });
  }

  private publishUnavailableTargetNotification(): void {
    this.appBus.publish({
      type: "Notification",
      payload: {
        header: "Notification target unavailable",
        body: "The terminal no longer exists.",
        type: "warning",
        timestamp: new Date(),
        channels: {
          app: true,
          os: false,
        },
      },
    });
  }
}
