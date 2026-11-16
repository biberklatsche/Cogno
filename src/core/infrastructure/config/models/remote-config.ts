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
        "The machine to connect to: a host name, `user@host` or an alias from your ssh config. Cogno must be running there.",
      ),
    command: z
      .string()
      .min(1)
      .optional()
      .describe(
        "Command ssh runs on that machine to reach Cogno there. Usually left out: Cogno finds it by itself and may fill this in after the first connection.",
      ),
  })
  .describe("One machine reached over ssh.");

export const RemoteConfigSchema = z.strictObject({
  hosts: z
    .record(z.string().min(1), RemoteHostSchema)
    .optional()
    .describe("Named machines whose running shells the Remote panel shows."),
});
