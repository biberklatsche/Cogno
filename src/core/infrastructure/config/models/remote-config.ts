import { z } from "zod";

/** What `remote.relay` says when machines in other networks are not to be reached. */
export const NO_RELAY = "off";

export const RemoteConfigSchema = z.strictObject({
  relay: z
    .union([z.literal(NO_RELAY), z.url({ protocol: /^https?$/ })])
    .optional()
    .describe(
      "The relay server through which paired machines in other networks find and reach each other. It only passes on encrypted data. `off` reaches paired machines in your local network only.",
    ),
});
