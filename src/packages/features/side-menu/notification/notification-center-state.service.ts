import { DestroyRef, Injectable, Signal, computed, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  FeatureModeContract,
  NotificationCenterItemContract,
  NotificationCenterItemIdContract,
  NotificationCenterPort,
} from "@cogno/core-api";
import {
  NotificationCenterState,
  NotificationCenterUseCase,
} from "@cogno/core-domain";

@Injectable({ providedIn: "root" })
export class NotificationCenterStateService {
  private sideMenuIconUpdater?: (iconName: string) => void;

  private readonly notificationCenterStateSignal = signal<NotificationCenterState>(
    NotificationCenterUseCase.createInitialState(),
  );

  readonly notifications: Signal<NotificationCenterItemContract[]> = computed(() =>
    NotificationCenterUseCase.getNotifications(this.notificationCenterStateSignal()),
  );

  constructor(
    private readonly notificationCenterPort: NotificationCenterPort,
    destroyRef: DestroyRef,
  ) {
    this.notificationCenterPort.notificationEvents$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((notificationEvent) => {
        const result = NotificationCenterUseCase.handleNotificationEvent(
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
      NotificationCenterUseCase.setFeatureMode(this.notificationCenterStateSignal(), mode),
    );
    if (mode === "off") {
      this.sideMenuIconUpdater?.("mdiBell");
    }
  }

  handleSideMenuOpen(): void {
    this.sideMenuIconUpdater?.("mdiBell");
  }

  handleSideMenuClose(): void {
    // no-op for now
  }

  remove(notificationId: NotificationCenterItemIdContract): void {
    this.notificationCenterStateSignal.set(
      NotificationCenterUseCase.remove(this.notificationCenterStateSignal(), notificationId),
    );
  }

  clear(): void {
    this.notificationCenterStateSignal.set(
      NotificationCenterUseCase.clear(this.notificationCenterStateSignal()),
    );
    this.sideMenuIconUpdater?.("mdiBell");
  }

  getNotificationCount(): number {
    return NotificationCenterUseCase.getNotificationCount(this.notificationCenterStateSignal());
  }
}
