import { z } from "zod";

export const ClipboardConfigSchema = z.strictObject({
  read: z
    .enum(["allow", "deny"])
    .optional()
    .describe("Whether programs in the terminal may read the clipboard (OSC 52)."),
  write: z
    .enum(["allow", "deny"])
    .optional()
    .describe("Whether programs in the terminal may write the clipboard (OSC 52)."),
  trim_trailing_spaces: z.boolean().optional().describe("Strip trailing spaces from copied lines."),
});

export type ClipboardConfig = z.infer<typeof ClipboardConfigSchema>;
