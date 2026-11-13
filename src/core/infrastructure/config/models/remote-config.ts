import { z } from "zod";

/**
 * Whether `destination` can be what ssh connects to: a host, `user@host` or
 * an alias - one word, and never an option ("-oProxyCommand=..." would run a
 * program on this machine).
 */
export function isSshDestination(destination: string): boolean {
  return destination.length > 0 && !destination.startsWith("-") && !/\s/.test(destination);
}

/** The config keys of the remote `name`. */
export function remoteHostKeys(name: string): { destination: string; command: string } {
  return {
    destination: `remote.hosts.${name}.destination`,
    command: `remote.hosts.${name}.command`,
  };
}

const RemoteHostSchema = z
  .strictObject({
    destination: z
      .string()
      .refine(
        isSshDestination,
        "One word: a host name, user@host or an ssh alias, never an option.",
      )
      .describe(
        "Where ssh connects: a host name, `user@host` or an alias from your ssh config. The machine must be reachable by ssh and have Cogno running.",
      ),
    command: z
      .string()
      .min(1)
      .optional()
      .describe(
        'Command ssh runs on that machine to reach the Cogno there. Left out, Cogno tries `".cogno/bin/cogno" server --stdio` and, for an ssh server that starts commands in PowerShell, `& ".cogno/bin/cogno" server --stdio`, and keeps the one that worked here.',
      ),
  })
  .describe("One machine reached over ssh.");

export const RemoteConfigSchema = z.strictObject({
  hosts: z
    .record(z.string().min(1), RemoteHostSchema)
    .optional()
    .describe("Named machines whose running shells the Remote panel shows."),
});
