import { z } from "zod";

export const GeneralConfigSchema = z.strictObject({
  enable_watch_config: z
    .boolean()
    .optional()
    .describe("Apply changes to the settings file as soon as it is saved."),
  update_install: z
    .enum(["background", "ask"])
    .optional()
    .describe(
      "How Cogno keeps itself up to date: `background` downloads a new version as soon as it is found and offers a restart; `ask` only announces it and downloads when you choose to update.",
    ),
  session_restore: z
    .strictObject({
      enabled: z
        .boolean()
        .optional()
        .describe(
          "Bring back your workspaces, tabs, panes and terminal output when Cogno starts. Off starts fresh each time; you save workspaces by hand instead.",
        ),
      scrollback: z
        .boolean()
        .optional()
        .describe(
          "Bring back what the terminals showed, above a separator line. Off restores the layout with empty terminals.",
        ),
      max_lines: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe(
          "How many lines of output are kept per terminal for the next start; 0 keeps none.",
        ),
    })
    .optional()
    .describe("Session restore: bring workspaces, tabs and scrollback back on the next launch."),
});
