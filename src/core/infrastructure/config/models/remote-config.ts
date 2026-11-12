import { z } from "zod";

const RemoteHostSchema = z
  .strictObject({
    destination: z
      .string()
      .min(1)
      .describe(
        "Where ssh connects: a host name, `user@host` or an alias from your ssh config. The machine must be reachable by ssh and have Cogno running.",
      ),
    command: z
      .string()
      .min(1)
      .optional()
      .describe(
        'Command ssh runs on that machine to reach the Cogno there. Set it when the ssh server there starts commands in PowerShell: `& ".cogno/bin/cogno" server --stdio`. Default: `".cogno/bin/cogno" server --stdio`.',
      ),
  })
  .describe("One machine reached over ssh.");

export const RemoteConfigSchema = z.strictObject({
  hosts: z
    .record(z.string().min(1), RemoteHostSchema)
    .optional()
    .describe("Named machines whose running shells the Remote panel shows."),
});
