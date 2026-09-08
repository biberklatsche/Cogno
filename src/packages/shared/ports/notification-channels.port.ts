// Stays in shared/: dual-consumed by core/workbench (session-notifications) and
// features (coding-agent). A port both layers need cannot move to core/api
// (step 24f).
export interface NotificationChannelOptionContract {
  readonly id: string;
  readonly displayName: string;
  readonly defaultEnabled: boolean;
}

export interface NotificationChannelsPortContract {
  getAvailableChannels(): ReadonlyArray<NotificationChannelOptionContract>;
}

export abstract class NotificationChannelsPort implements NotificationChannelsPortContract {
  abstract getAvailableChannels(): ReadonlyArray<NotificationChannelOptionContract>;
}
