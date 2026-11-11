import { z } from "zod";

export const ClipboardConfigSchema = z.strictObject({
  read: z
    .enum(["ask", "allow", "deny"])
    .optional()
    .describe(
      "Whether programs in the terminal may read your clipboard (OSC 52); `ask` asks each time. Your own pasting always works.",
    ),
  write: z
    .enum(["allow", "deny"])
    .optional()
    .describe("Whether programs in the terminal may put text on your clipboard (OSC 52)."),
  trim_trailing_spaces: z.boolean().optional().describe("Strip trailing spaces from copied lines."),
});
