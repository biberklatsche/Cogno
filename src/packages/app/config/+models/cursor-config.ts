import {z} from 'zod';
import {HexColorSchema} from "./shared";

export const CursorSchema = z.object({
    width: z.number().int().min(0, 'Cursor-With must be at least 0').max(10, 'Cursor-With must be at most 10').optional(),
    blink: z.boolean().optional(),
    style: z
        .enum(['bar', 'underline', 'block'])
        .optional(),
    inactive_style: z
        .enum(['outline', 'block', 'bar', 'underline', 'none'])
        .optional(),
    color: HexColorSchema.optional(),
    accent_color: HexColorSchema.optional(),
    alt_click_moves_cursor: z.boolean().optional()
})

export type Cursor = z.infer<typeof CursorSchema>;


