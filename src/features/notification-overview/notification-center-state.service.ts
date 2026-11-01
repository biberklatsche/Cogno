import { computed, DestroyRef, Injectable, Signal, signal } from "@angular/core";
import { ApplicationConfigurationPort } from "@cogno/core/api/application-configuration-port";
import { Limit, resolveLimit } from "@cogno/core/api/contributions";
import { NotificationCenterPort } from "@cogno/core/api/notification-center-port";
import { NotificationEventPayloadContract, NotificationTargetContract } from "@cogno/shared/domain";
import { Subscription } from "rxjs";
import {
  NotificationCenterItemContract,
  NotificationCenterItemIdContract,
} from "./notification-center-item";

type Items = ReadonlyMap<NotificationCenterItemIdContract, NotificationCenterItemContract>;

@Injectable({ providedIn: "root" })
export class NotificationCenterStateService {
  private readonly items = signal<Items>(new Map());
  private readonly unreadSignal = signal(false);
  private collecting?: Subscription;

  /** Newest first. */
  readonly notifications: Signal<NotificationCenterItemContract[]> = computed(() =>
    [...this.items().values()].sort(
      (left, right) => right.timestamp.getTime() - left.timestamp.getTime(),
    ),
  );
  /** A notification arrived since the panel was last opened. */
  readonly unread = this.unreadSignal.asReadonly();

  constructor(
    private readonly notificationCenterPort: NotificationCenterPort,
    private readonly configPort: ApplicationConfigurationPort,
    destroyRef: DestroyRef,
  ) {
    destroyRef.onDestroy(() => this.stop());
  }

  /** Feature on: collect notifications until `stop()`. */
  start(): void {
    if (this.collecting) return;
    this.collecting = this.notificationCenterPort.notificationEvents$.subscribe((event) =>
      this.add(event),
    );
  }

  /** Feature off: stop collecting and forget what was collected. */
  stop(): void {
    this.collecting?.unsubscribe();
    this.collecting = undefined;
    this.items.set(new Map());
    this.unreadSignal.set(false);
  }

  /** Panel opened: whatever is there has been seen. */
  markRead(): void {
    this.unreadSignal.set(false);
  }

  remove(notificationId: NotificationCenterItemIdContract): void {
    this.items.update((items) => {
      const next = new Map(items);
      next.delete(notificationId);
      return next;
    });
  }

  clear(): void {
    this.items.set(new Map());
    this.unreadSignal.set(false);
  }

  openTarget(target: NotificationTargetContract): void {
    this.notificationCenterPort.openTarget(target);
  }

  /** The same notification again counts up instead of repeating; the oldest go once the list is full. */
  private add(event: NotificationEventPayloadContract): void {
    const id = notificationId(event);
    const timestamp = event.timestamp ?? new Date();
    this.items.update((items) => {
      const next = new Map(items);
      const existing = next.get(id);
      next.set(
        id,
        existing
          ? { ...existing, count: existing.count + 1, timestamp }
          : {
              id,
              header: event.header,
              body: event.body,
              target: event.target,
              type: event.type ?? "info",
              count: 1,
              timestamp,
            },
      );
      return trim(next, this.overviewMaxItems());
    });
    this.unreadSignal.set(true);
  }

  /** How many notifications the overview keeps, from the feature's own settings. */
  private overviewMaxItems(): number {
    const config = this.configPort.getConfiguration() as
      | { feature?: { notification_overview?: { overview?: { max_items?: Limit } } } }
      | undefined;
    return resolveLimit(config?.feature?.notification_overview?.overview?.max_items, 30);
  }
}

/** Notifications with the same text and target are one entry. */
function notificationId(event: NotificationEventPayloadContract): NotificationCenterItemIdContract {
  const target = event.target;
  return [event.header, event.body, target?.workspaceId, target?.tabId, target?.terminalId]
    .map((part) => part ?? "")
    .join("|");
}

function trim(
  items: Map<NotificationCenterItemIdContract, NotificationCenterItemContract>,
  max: number,
): Items {
  if (items.size <= max) return items;
  const oldestFirst = [...items.values()].sort(
    (left, right) => left.timestamp.getTime() - right.timestamp.getTime(),
  );
  for (const item of oldestFirst.slice(0, items.size - max)) {
    items.delete(item.id);
  }
  return items;
}
