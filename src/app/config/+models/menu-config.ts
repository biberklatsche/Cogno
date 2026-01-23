import {z} from 'zod';

export const MenuSchema = z.object({
    opacity: z.number().int().min(0, 'Opacity must be at least 0').max(100, 'Opacity must be at most 100').optional(),
});

export type Menu = z.infer<typeof MenuSchema>;
