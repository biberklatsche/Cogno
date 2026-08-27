import { z } from "zod";

export const ImageSchema = z.object({
  path: z.string().optional(),
  opacity: z
    .number()
    .int()
    .min(0, "Opacity must be at least 0")
    .max(100, "Opacity must be at most 100")
    .optional(),
  blur: z
    .number()
    .int()
    .min(0, "Blur must be at least 0")
    .max(10, "Blur must be at most 10")
    .optional(),
});

export type Image = z.infer<typeof ImageSchema>;
