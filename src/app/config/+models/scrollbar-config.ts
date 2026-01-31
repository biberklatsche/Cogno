import {z} from 'zod';
import {HexColorSchema} from "./shared";

export const ScrollbarSchema = z.object({
    width: z.number().int().min(0, 'Cursor-With must be at least 0').optional(),
    overview_ruler_border_color: HexColorSchema.optional(),
    slider_color: HexColorSchema.optional(),
    slider_hover_color: HexColorSchema.optional(),
    slider_active_color: HexColorSchema.optional(),
    sensitivity: z.number().int().min(0, 'Scrollbar sensitivity must be at least 0').optional(),
    scroll_on_user_input: z.boolean().optional(),
    smooth_scroll_duration: z.number().int().min(0, 'Scrollbar smooth scroll duration must be at least 0').optional(),
    fast_scroll_sensitivity: z.number().int().min(0, 'Scrollbar smooth scroll duration must be at least 0').optional(),
    scrollback_lines: z
        .number()
        .int()
        .min(100, "Scrollback lines must be at least 100")
        .optional(),
})

export type Scrollbar = z.infer<typeof ScrollbarSchema>;
