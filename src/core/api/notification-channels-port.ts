export interface NotificationChannelOptionContract {
  readonly id: string;
  readonly displayName: string;
  readonly defaultEnabled: boolean;
}

export abstract class NotificationChannelsPort {
  abstract getAvailableChannels(): ReadonlyArray<NotificationChannelOptionContract>;
}
