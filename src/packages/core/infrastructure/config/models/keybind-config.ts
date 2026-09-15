import { z } from "zod";

export const KeybindSchema = z
  .string()
  .regex(
    /^(?:(?:broadcast|unconsumed|performable|always):)*[^\s=>:]+(?:\+[^\s=>:]+)*(?:>(?:[^\s=>:]+(?:\+[^\s=>:]+)*))*=[A-Za-z0-9_]+(?::[A-Za-z0-9_]+)*$/,
    "Keybind must be of the form [trigger:]*combo[>combo...]=action[:arg...]",
  );

export const KeybindsSchema = z
  .array(KeybindSchema)
  .describe(
    "Keybinding lines, additive: `[trigger:]combo[>combo...]=action[:arg...]`. " +
      "Triggers: `always` (also while a text input has focus), `performable` (only when the " +
      "action is currently available), `broadcast`, `unconsumed`.",
  );

export type Keybinding = z.infer<typeof KeybindsSchema>;
