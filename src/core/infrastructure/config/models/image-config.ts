import { z } from "zod";

export const ImageSchema = z.strictObject({
  path: z
    .string()
    .optional()
    .describe("Path to a background image; empty means no background image."),
  opacity: z
    .number()
    .int()
    .min(0, "Opacity must be at least 0")
    .max(100, "Opacity must be at most 100")
    .optional()
    .describe("Opacity of the background image, 0-100."),
  blur: z
    .number()
    .int()
    .min(0, "Blur must be at least 0")
    .max(10, "Blur must be at most 10")
    .optional()
    .describe("Blur radius applied to the background image, 0-10."),
});
