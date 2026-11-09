import { z } from "zod";

export const AutocompleteSettingsSchema = z.strictObject({
  provider: z
    .strictObject({
      timeout_ms: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe("Maximum time in milliseconds for one dynamic autocomplete provider."),
    })
    .optional(),
  allowed_return_codes: z
    .array(z.number().int())
    .optional()
    .describe(
      "Return codes a command may exit with to be suggested by autocomplete, e.g. `[0]` to suggest only successful commands. Empty (default) suggests every command the shell found. The history keeps every command regardless. A command's own list under `allowed_return_codes_by_command` wins.",
    ),
  allowed_return_codes_by_command: z
    .record(z.string(), z.array(z.number().int()))
    .optional()
    .describe(
      'Return codes allowed for one command, matched by its first word, e.g. `allowed_return_codes_by_command.grep = [0,1]` because exit 1 means "no match". Overrides `allowed_return_codes` for that command.',
    ),
});
