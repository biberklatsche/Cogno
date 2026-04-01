import {z} from 'zod';

export const KeybindSchema = z.string().regex(
    /^[^\s=>]+(?:\+[^\s=>]+)*(?:>(?:[^\s=>]+(?:\+[^\s=>]+)*))*=(?:\[(?:all|unconsumed|performable)(?::(?:all|unconsumed|performable))*\])?[A-Za-z0-9_]+(?::[A-Za-z0-9_]+)*$/,
    "Keybind must be of the form combo[>combo...]=[triggers]action[:arg...]"
);

export const KeybindsSchema = z.array(KeybindSchema);

export type Keybinding = z.infer<typeof KeybindsSchema>;


