export type NotificationTypeContract = "error" | "success" | "warning" | "info";

export type NotificationChannelsContract = Readonly<Record<string, boolean>>;

export interface NotificationEventPayloadContract {
  readonly header: string;
  readonly body?: string;
  readonly source?: string;
  readonly terminalId?: string;
  readonly timestamp?: Date;
  readonly type?: NotificationTypeContract;
  readonly channels?: Partial<NotificationChannelsContract>;
}

export interface NotificationChannelSettingsContract {
  readonly available?: boolean;
  readonly enabled?: boolean;
}

export interface NotificationChannelDispatchRequestContract {
  readonly notification: NotificationEventPayloadContract;
  readonly settings: Readonly<Record<string, unknown>>;
}

export interface NotificationChannelContract {
  readonly displayName: string;
  readonly id: string;
  isAvailable?(): boolean;
  dispatch(notificationChannelDispatchRequest: NotificationChannelDispatchRequestContract): Promise<void> | void;
}

export interface NotificationReplyChannelContract extends NotificationChannelContract {
  startReceivingReplies?(): Promise<void> | void;
  stopReceivingReplies?(): Promise<void> | void;
}
