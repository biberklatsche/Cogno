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
