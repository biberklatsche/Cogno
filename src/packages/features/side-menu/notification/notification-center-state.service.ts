import { DestroyRef, Injectable, Signal, computed, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  FeatureModeContract,
  NotificationCenterItemContract,
  NotificationCenterItemIdContract,
  NotificationCenterPort,
} from "@cogno/core-api";
import {
  NotificationInboxState,
  NotificationInboxUseCase,
} from "@cogno/core-domain";

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
    destroyRef: DestroyRef,
  ) {
    this.notificationCenterPort.notificationEvents$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((notificationEvent) => {
        const result = NotificationInboxUseCase.handleNotificationEvent(
          this.notificationCenterStateSignal(),
          notificationEvent,
          this.notificationCenterPort.getOverviewMaxItems(),
        );
        this.notificationCenterStateSignal.set(result.state);
        if (result.shouldShowBadge) {
          this.sideMenuIconUpdater?.("mdiBellBadge");
        }
      });
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

  handleSideMenuClose(): void {
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

  getNotificationCount(): number {
    return NotificationInboxUseCase.getNotificationCount(this.notificationCenterStateSignal());
  }
}
