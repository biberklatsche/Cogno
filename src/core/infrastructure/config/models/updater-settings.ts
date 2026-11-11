import { z } from "zod";

export const UpdaterSettingsSchema = z.strictObject({
  install: z
    .enum(["background", "ask"])
    .optional()
    .describe(
      "`background` downloads a new version as soon as it is found and offers a restart; `ask` only announces it and downloads when you choose to update.",
    ),
});
