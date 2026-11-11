import { z } from "zod";

const RemoteHostSchema = z
  .strictObject({
    destination: z
      .string()
      .min(1)
      .describe(
        "Where ssh connects: a host name, `user@host` or an alias from your ssh config. The machine must be reachable by ssh and have Cogno installed.",
      ),
    command: z
      .string()
      .min(1)
      .optional()
      .describe(
        "Command that starts Cogno on that machine. Set it when `cogno` is not on the PATH of an ssh session there. Default: `cogno server --stdio`.",
      ),
  })
  .describe("One machine reached over ssh.");

export const RemoteConfigSchema = z.strictObject({
  hosts: z
    .record(z.string().min(1), RemoteHostSchema)
    .optional()
    .describe("Named machines a shell profile can run on (`shell.profiles.<name>.host`)."),
});

export type RemoteHostConfig = z.infer<typeof RemoteHostSchema>;
