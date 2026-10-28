import { NotificationSourceContract } from "@cogno/core/api/contributions";
import { z } from "zod";

/**
 * The sources the shipped defaults name, for tests of the config reader: the
 * reader knows only the sources it is given, and the defaults mention these.
 */
export const notificationSourcesFixture: ReadonlyArray<NotificationSourceContract> = [
  {
    id: "terminal",
    label: "Terminal",
    events: [
      { id: "osc9", label: "OSC 9" },
      {
        id: "long_running_command",
        label: "Long-running command",
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
  },
  {
    id: "coding_agents",
    label: "Coding agents",
    events: [
      { id: "working", label: "Working" },
      { id: "question", label: "Question" },
      { id: "ready", label: "Ready" },
      { id: "error", label: "Error" },
    ],
  },
  {
    id: "errors",
    label: "Errors",
    events: [
      { id: "handled", label: "Handled" },
      { id: "unhandled", label: "Unhandled" },
    ],
  },
];
