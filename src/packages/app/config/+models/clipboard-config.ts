import { z } from "zod";

export const ClipboardConfigSchema = z.object({
  read: z.enum(["allow", "deny"]).optional(),
  write: z.enum(["allow", "deny"]).optional(),
  trim_trailing_spaces: z.boolean().optional(),
  image_paste_ttl_seconds: z.number().int().positive().optional(),
});

export type ClipboardConfig = z.infer<typeof ClipboardConfigSchema>;
