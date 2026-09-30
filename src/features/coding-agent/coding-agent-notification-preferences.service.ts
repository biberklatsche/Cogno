import { DestroyRef, Injectable, Signal, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ApplicationConfigurationPort } from "@cogno/core/api/application-configuration-port";
import {
  NotificationChannelOptionContract,
  NotificationChannelsPort,
} from "@cogno/core/api/notification-channels-port";
import {
  NotificationDefinitionContract,
  NotificationPreferencesState,
  NotificationPreferencesUseCase,
} from "@cogno/shared/domain";
import { AgentStatus } from "./agent-status";

const NOTIFICATION_LABELS: Record<AgentStatus, string> = {
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

  /**
   * Follows the config: when the configured notifications or the available
   * channels change, the preferences start over from them. Any other config
   * change leaves what was toggled in the panel alone.
   */
  constructor(
    private readonly configPort: ApplicationConfigurationPort,
    private readonly channelsPort: NotificationChannelsPort,
    destroyRef: DestroyRef,
  ) {
    let appliedDefaults: string | undefined;
    this.configPort.configuration$.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => {
      const definitions = this.getNotificationDefinitions();
      const channelOptions = this.channelsPort.getAvailableChannels();
      const defaults = JSON.stringify({ definitions, channelOptions });
      if (defaults === appliedDefaults) return;
      appliedDefaults = defaults;
      this.channelOptions = channelOptions;
      this.stateSignal.set(
        NotificationPreferencesUseCase.createInitialState(definitions, channelOptions),
      );
    });
  }

  getNotificationDefinitions(): ReadonlyArray<NotificationDefinitionContract> {
    const config = this.configPort.getConfiguration() as
      | {
          feature?: {
            coding_agents?: {
              notifications?: Readonly<Record<string, { enabled?: boolean }>>;
            };
          };
        }
      | undefined;
    const notificationsConfig = config?.feature?.coding_agents?.notifications;

    return (Object.keys(NOTIFICATION_LABELS) as ReadonlyArray<AgentStatus>).map((status) => ({
      id: status,
      label: NOTIFICATION_LABELS[status],
      defaultEnabled: notificationsConfig?.[status]?.enabled ?? false,
    }));
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
