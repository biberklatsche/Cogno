import { ZodRawShape } from "zod";

/**
 * One thing a source can notify about: `ready` for a coding agent, `osc9`
 * for the terminal. Switched on or off at `notification.source.<source>.<event>.enabled`;
 * `settings` are the event's own further keys under the same path.
 */
export interface NotificationEventContract {
  readonly id: string;
  /** What the settings page shows: "Agent becomes ready". */
  readonly label: string;
  /** What the settings reference says: "Notify when an agent becomes ready."; `label` when absent. */
  readonly description?: string;
  readonly settings?: ZodRawShape;
}

/**
 * A source of notifications - the terminal, the coding agents, the error
 * reporter - as it declares itself. Core composes the config schema
 * (`notification.source.<id>`), the defaults and the settings page from these
 * declarations and knows no event of its own.
 */
export interface NotificationSourceContract {
  readonly id: string;
  /** What the settings page shows: "Coding agents". */
  readonly label: string;
  readonly events: ReadonlyArray<NotificationEventContract>;
}
