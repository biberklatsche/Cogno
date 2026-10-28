import { NotificationSourceContract } from "@cogno/core/api/contributions";
import { z } from "zod";

export const TERMINAL_NOTIFICATION_SOURCE_ID = "terminal";
export const OSC9_EVENT_ID = "osc9";
export const LONG_RUNNING_COMMAND_EVENT_ID = "long_running_command";
export const DEFAULT_LONG_RUNNING_COMMAND_MINIMUM_DURATION_SECONDS = 10;

/** What the terminal itself notifies about; no Angular here, the generators read it too. */
export const TERMINAL_NOTIFICATION_SOURCE: NotificationSourceContract = {
  id: TERMINAL_NOTIFICATION_SOURCE_ID,
  label: "Terminal",
  events: [
    {
      id: OSC9_EVENT_ID,
      label: "A program asks for attention",
      description: "Notify when a program sends a notification via the OSC 9 escape sequence.",
    },
    {
      id: LONG_RUNNING_COMMAND_EVENT_ID,
      label: "A long-running command finishes",
      description: "Notify when a command that ran for a while has finished.",
      settings: {
        minimum_duration_seconds: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Notify only when a command ran for at least this many seconds."),
      },
    },
  ],
};
