import { z } from "zod";

export const KeybindSchema = z
  .string()
  .regex(
    /^(?:(?:broadcast|unconsumed|performable|always):)*[^\s=>:]+(?:\+[^\s=>:]+)*(?:>(?:[^\s=>:]+(?:\+[^\s=>:]+)*))*=[A-Za-z0-9_]+(?::[A-Za-z0-9_]+)*$/,
    "Keybind must be of the form [trigger:]*combo[>combo...]=action[:arg...]",
  );

export const KeybindsSchema = z.array(KeybindSchema);

export type Keybinding = z.infer<typeof KeybindsSchema>;
