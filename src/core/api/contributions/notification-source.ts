import { z } from "zod";

/** A further key of an event, next to `enabled`: its schema and its default, as the file spells it. */
export interface NotificationEventSettingContract {
  readonly schema: z.ZodType;
  readonly default: string;
}

/**
 * One thing a source can notify about: `ready` for a coding agent, `osc9`
 * for the terminal. Switched at `notification.source.<source>.<event>.enabled`,
 * off by default - a user switches on what they want to hear about.
 * `settings` are the event's own further keys under the same path.
 */
export interface NotificationEventContract {
  readonly id: string;
  /** What the settings page shows: "Agent becomes ready". */
  readonly label: string;
  /** What the settings reference says: "Notify when an agent becomes ready."; `label` when absent. */
  readonly description?: string;
  readonly settings?: Readonly<Record<string, NotificationEventSettingContract>>;
}

/**
 * A source of notifications - the terminal, the coding agents, the error
 * reporter - as it declares itself. Core composes the config schema, the
 * defaults (`notification.source.<id>`), the reference and the settings page
 * from these declarations and knows no event of its own.
 */
export interface NotificationSourceContract {
  readonly id: string;
  /** What the settings page shows: "Coding agents". */
  readonly label: string;
  readonly events: ReadonlyArray<NotificationEventContract>;
}
