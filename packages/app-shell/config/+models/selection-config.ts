import {z} from 'zod';
import {HexColorSchema} from "./shared";

export const SelectionSchema = z.object({
    clear_on_copy: z.boolean().optional(),
    background_color: HexColorSchema.optional(),
    inactive_background_color: HexColorSchema.optional(),
    right_click_selects_word: z.boolean().optional(),
})

export type Selection = z.infer<typeof SelectionSchema>;
