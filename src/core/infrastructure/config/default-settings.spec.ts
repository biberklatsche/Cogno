import { describe, expect, it } from "vitest";
import { z } from "zod";
import { composeDefaultSettings } from "./default-settings";
import { defaultSettings } from "./models/default-config-values";

describe("composeDefaultSettings", () => {
  it("turns every declared event off and gives its settings their declared default", () => {
    const defaults = composeDefaultSettings([
      {
        id: "terminal",
        label: "Terminal",
        events: [
          { id: "osc9", label: "OSC 9" },
          {
            id: "long_running_command",
            label: "Long-running command",
            settings: { minimum_duration_seconds: { schema: z.number(), default: "10" } },
          },
        ],
      },
    ]);

    expect(defaults["notification"]).toEqual({
      ...defaultSettings.notification,
      source: {
        terminal: {
          osc9: { enabled: "false" },
          long_running_command: { enabled: "false", minimum_duration_seconds: "10" },
        },
      },
    });
    expect(defaults["font"]).toBe(defaultSettings.font);
  });
});
