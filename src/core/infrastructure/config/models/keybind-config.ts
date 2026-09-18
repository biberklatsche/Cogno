import { z } from "zod";

const KeybindSchema = z
  .string()
  .regex(
    /^(?:(?:broadcast|unconsumed|performable|always):)*[^\s=>:]+(?:\+[^\s=>:]+)*(?:>(?:[^\s=>:]+(?:\+[^\s=>:]+)*))*=[A-Za-z0-9_]+(?::[A-Za-z0-9_]+)*$/,
    "Keybind must be of the form [trigger:]*combo[>combo...]=action[:arg...]",
  );

export const KeybindsSchema = z
  .array(KeybindSchema)
  .describe(
    "Keybinding lines, additive: `[trigger:]combo[>combo...]=action[:arg...]`. " +
      "Triggers: `always` (also while a full-screen terminal app runs), `performable` (the " +
      "key is only consumed when the action did something), `broadcast`, `unconsumed`.",
  );

export type Keybinding = z.infer<typeof KeybindsSchema>;
