export interface NotificationPreferencesState {
  readonly notifications: Readonly<Record<string, boolean>>;
  readonly channels: Readonly<Record<string, boolean>>;
}
