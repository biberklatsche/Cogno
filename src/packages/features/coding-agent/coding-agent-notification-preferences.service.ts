import { Injectable, Signal, signal } from "@angular/core";
import {
  ApplicationConfigurationPort,
  NotificationChannelOptionContract,
  NotificationChannelsPort,
  NotificationDefinitionContract,
} from "@cogno/core-api";
import { NotificationPreferencesState, NotificationPreferencesUseCase } from "@cogno/core-domain";
import { take } from "rxjs";
import { ActiveAgent } from "./coding-agent-status.service";

const NOTIFICATION_LABELS: Record<ActiveAgent["status"], string> = {
  working: "Agent starts working",
  question: "Agent has a question",
  ready: "Agent becomes ready",
  error: "Agent reports an error",
};

@Injectable({ providedIn: "root" })
export class CodingAgentNotificationPreferencesService {
  private channelOptions: ReadonlyArray<NotificationChannelOptionContract> = [];
  private readonly stateSignal = signal<NotificationPreferencesState>({
    notifications: {},
    channels: {},
  });

  readonly state: Signal<NotificationPreferencesState> = this.stateSignal.asReadonly();

  constructor(
    private readonly configPort: ApplicationConfigurationPort,
    private readonly channelsPort: NotificationChannelsPort,
  ) {
    this.configPort.configuration$.pipe(take(1)).subscribe(() => {
      this.channelOptions = this.channelsPort.getAvailableChannels();
      this.stateSignal.set(
        NotificationPreferencesUseCase.createInitialState(
          this.getNotificationDefinitions(),
          this.channelOptions,
        ),
      );
    });
  }

  getNotificationDefinitions(): ReadonlyArray<NotificationDefinitionContract> {
    const config = this.configPort.getConfiguration() as
      | {
          coding_agents?: {
            notifications?: Readonly<Record<string, { enabled?: boolean }>>;
          };
        }
      | undefined;
    const notificationsConfig = config?.coding_agents?.notifications;

    return (Object.keys(NOTIFICATION_LABELS) as ReadonlyArray<ActiveAgent["status"]>).map(
      (status) => ({
        id: status,
        label: NOTIFICATION_LABELS[status],
        defaultEnabled: notificationsConfig?.[status]?.enabled ?? true,
      }),
    );
  }

  getChannelOptions(): ReadonlyArray<NotificationChannelOptionContract> {
    return this.channelOptions;
  }

  toggleNotification(notificationId: string): void {
    this.stateSignal.set(
      NotificationPreferencesUseCase.toggleNotification(this.stateSignal(), notificationId),
    );
  }

  toggleChannel(channelId: string): void {
    this.stateSignal.set(
      NotificationPreferencesUseCase.toggleChannel(this.stateSignal(), channelId),
    );
  }

  shouldNotify(notificationId: string): boolean {
    return NotificationPreferencesUseCase.shouldNotify(this.stateSignal(), notificationId);
  }

  getActiveChannels() {
    return NotificationPreferencesUseCase.getActiveChannels(this.stateSignal());
  }
}
