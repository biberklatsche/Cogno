import {z} from 'zod';

export const PaddingValueSchema = z.number().min(0);

export const PaddingSchema = z.object({
    left: PaddingValueSchema.optional(),
    right: PaddingValueSchema.optional(),
    top: PaddingValueSchema.optional(),
    bottom: PaddingValueSchema.optional(),
    remove_on_full_screen_app: z.boolean().optional(),
});

export type Padding = z.infer<typeof PaddingSchema>;
