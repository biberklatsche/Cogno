import { DestroyRef, Injectable } from "@angular/core";
import { WorkspaceHostPort } from "@cogno/core-api";
import { firstValueFrom, Subscription, take } from "rxjs";
import { AppBus } from "../../app-bus/app-bus";
import { GridListService } from "../../grid-list/+state/grid-list.service";

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
    private readonly workspaceHostPort: WorkspaceHostPort,
    destroyRef: DestroyRef,
  ) {
    const subscription = new Subscription();
    subscription.add(
      this.appBus
        .on$({ path: ["app", "notification"], type: "OpenNotificationTarget" })
        .subscribe((event) => {
          void this.openTarget(event.payload);
        }),
    );
    destroyRef.onDestroy(() => {
      subscription.unsubscribe();
    });
  }

  async openTarget(target: NotificationTargetRuntime | undefined): Promise<void> {
    if (!target) {
      return;
    }

    const workspaceEntries = await firstValueFrom(
      this.workspaceHostPort.workspaceEntries$.pipe(take(1)),
    );
    if (!workspaceEntries.some((workspaceEntry) => workspaceEntry.id === target.workspaceId)) {
      this.publishUnavailableTargetNotification();
      return;
    }

    await this.workspaceHostPort.restoreWorkspace(target.workspaceId);
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

    if (target.terminalId) {
      this.scheduleTerminalFocus(target);
    }
  }

  private scheduleTerminalFocus(target: NotificationTargetRuntime): void {
    const terminalId = target.terminalId;
    if (!terminalId) {
      return;
    }

    const scheduleFocus =
      globalThis.requestAnimationFrame ??
      ((callback: FrameRequestCallback) => queueMicrotask(() => callback(0)));

    scheduleFocus(() => {
      const terminalWorkspaceId =
        this.gridListService.findWorkspaceIdentifierByTerminalId(terminalId);
      const terminalTabId = this.gridListService.findTabIdByTerminalId(terminalId);
      if (terminalWorkspaceId !== target.workspaceId || terminalTabId !== target.tabId) {
        this.publishUnavailableTargetNotification();
        return;
      }

      this.appBus.publish({
        path: ["app", "terminal"],
        type: "FocusTerminal",
        payload: terminalId,
      });
    });
  }

  private publishUnavailableTargetNotification(): void {
    this.appBus.publish({
      path: ["notification"],
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
