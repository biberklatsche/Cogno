import {z} from 'zod';

export const FontWeightSchema = z.union([
    z.enum([
        "normal",
        "bold",
        "100",
        "200",
        "300",
        "400",
        "500",
        "600",
        "700",
        "800",
        "900",
    ]),
    z.number(),
]);

export const AppFontSchema = z.object({
    family: z.string().optional(),
    size: z.number().int().min(1, 'Font size must be at least 1').optional(),
})

export const FontSchema = z.object({
    family: z.string().optional(),
    size: z.number().int().min(1, 'Font size must be at least 1').optional(),
    enable_ligatures: z.boolean().optional(),
    weight: FontWeightSchema.optional(),
    weight_bold: FontWeightSchema.optional(),
    custom_glyphs: z.boolean().optional(),
    draw_bold_text_in_bright_colors: z.boolean().optional(),
    rescale_overlapping_glyphs: z.boolean().optional(),
    app: AppFontSchema.optional(),
});

export type Font = z.infer<typeof FontSchema>;


