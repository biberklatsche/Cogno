export type NotificationTypeContract = "error" | "success" | "warning" | "info";

export type NotificationChannelsContract = Readonly<Record<string, boolean>>;

export interface NotificationTargetContract {
  readonly workspaceId: string;
  readonly tabId: string;
  readonly terminalId?: string;
  readonly label?: string;
}

/**
 * The declared event a notification belongs to: `ready` of `coding_agents`.
 * Whether it is shown is decided in one place, by its switch; a notification
 * without an event is always shown.
 */
export interface NotificationEventRefContract {
  readonly source: string;
  readonly id: string;
}

export interface NotificationEventPayloadContract {
  readonly header: string;
  readonly event?: NotificationEventRefContract;
  readonly body?: string;
  readonly source?: string;
  readonly terminalId?: string;
  readonly target?: NotificationTargetContract;
  readonly timestamp?: Date;
  readonly type?: NotificationTypeContract;
  readonly channels?: Partial<NotificationChannelsContract>;
}

export interface NotificationChannelSettingsContract {
  readonly enabled?: boolean;
}

export interface NotificationChannelDispatchRequestContract {
  readonly notification: NotificationEventPayloadContract;
  readonly settings: Readonly<Record<string, unknown>>;
}

export interface NotificationChannelContract {
  readonly displayName: string;
  readonly id: string;
  readonly sortOrder: number;
  isAvailable?(): boolean;
  dispatch(
    notificationChannelDispatchRequest: NotificationChannelDispatchRequestContract,
  ): Promise<void> | void;
}

export interface NotificationReplyChannelContract extends NotificationChannelContract {
  startReceivingReplies?(settings: Readonly<Record<string, unknown>>): Promise<void> | void;
  stopReceivingReplies?(): Promise<void> | void;
}
