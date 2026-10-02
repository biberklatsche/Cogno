import { computed, DestroyRef, Injectable, Signal, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ApplicationConfigurationPort } from "@cogno/core/api/application-configuration-port";
import { Limit, resolveLimit } from "@cogno/core/api/contributions";
import { NotificationCenterPort } from "@cogno/core/api/notification-center-port";
import { FeatureModeContract, NotificationTargetContract } from "@cogno/shared/domain";
import { NotificationInboxState, NotificationInboxUseCase } from "./inbox";
import {
  NotificationCenterItemContract,
  NotificationCenterItemIdContract,
} from "./notification-center-item";

@Injectable({ providedIn: "root" })
export class NotificationCenterStateService {
  private sideMenuIconUpdater?: (iconName: string) => void;

  private readonly notificationCenterStateSignal = signal<NotificationInboxState>(
    NotificationInboxUseCase.createInitialState(),
  );

  readonly notifications: Signal<NotificationCenterItemContract[]> = computed(() =>
    NotificationInboxUseCase.getNotifications(this.notificationCenterStateSignal()),
  );

  constructor(
    private readonly notificationCenterPort: NotificationCenterPort,
    private readonly configPort: ApplicationConfigurationPort,
    destroyRef: DestroyRef,
  ) {
    this.notificationCenterPort.notificationEvents$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((notificationEvent) => {
        const result = NotificationInboxUseCase.handleNotificationEvent(
          this.notificationCenterStateSignal(),
          notificationEvent,
          this.overviewMaxItems(),
        );
        this.notificationCenterStateSignal.set(result.state);
        if (result.shouldShowBadge) {
          this.sideMenuIconUpdater?.("mdiBellBadge");
        }
      });
  }

  /** How many notifications the overview keeps, from the feature's own settings. */
  private overviewMaxItems(): number {
    const config = this.configPort.getConfiguration() as
      | { feature?: { notification_overview?: { overview?: { max_items?: Limit } } } }
      | undefined;
    return resolveLimit(config?.feature?.notification_overview?.overview?.max_items, 30);
  }

  setSideMenuIconUpdater(sideMenuIconUpdater: (iconName: string) => void): void {
    this.sideMenuIconUpdater = sideMenuIconUpdater;
  }

  handleSideMenuModeChange(mode: FeatureModeContract): void {
    this.notificationCenterStateSignal.set(
      NotificationInboxUseCase.setCollectionMode(this.notificationCenterStateSignal(), mode),
    );
    if (mode === "off") {
      this.sideMenuIconUpdater?.("mdiBell");
    }
  }

  handleSideMenuOpen(): void {
    this.sideMenuIconUpdater?.("mdiBell");
  }

  remove(notificationId: NotificationCenterItemIdContract): void {
    this.notificationCenterStateSignal.set(
      NotificationInboxUseCase.remove(this.notificationCenterStateSignal(), notificationId),
    );
  }

  clear(): void {
    this.notificationCenterStateSignal.set(
      NotificationInboxUseCase.clear(this.notificationCenterStateSignal()),
    );
    this.sideMenuIconUpdater?.("mdiBell");
  }

  openTarget(target: NotificationTargetContract): void {
    this.notificationCenterPort.openTarget(target);
  }
}
