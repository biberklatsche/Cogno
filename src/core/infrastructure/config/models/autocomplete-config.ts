import { z } from "zod";

export const AutocompleteConfigSchema = z.strictObject({
  provider: z
    .strictObject({
      timeout_ms: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe(
          "How long autocomplete waits, in milliseconds, for suggestions it has to look up (branches, containers) before it shows the rest.",
        ),
    })
    .optional(),
  allowed_return_codes: z
    .array(z.number().int())
    .optional()
    .describe(
      "Exit codes a command may end with to be suggested; `[0]` suggests only successful commands, empty suggests all.",
    ),
  allowed_return_codes_by_command: z
    .record(z.string(), z.array(z.number().int()))
    .optional()
    .describe(
      "Exit codes for one command, named by its first word, instead of `allowed_return_codes`; e.g. `allowed_return_codes_by_command.grep = [0,1]`.",
    ),
});
