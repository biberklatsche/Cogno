import { FeatureModeContract } from "@cogno/shared/domain";
import { z } from "zod";

export const hexColorSchema = z.preprocess(
  (val) => (typeof val === "string" && val.startsWith("#") ? val.slice(1) : val),
  z
    .string()
    .regex(
      /^(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/,
      "Must be a 4-, 6-, or 8-digit hex color",
    ),
);

/** Accepts the legacy "hidden"/"visible" and reads both as "on". */
export const featureModeSchema = z.preprocess(
  (value) => (value === "hidden" || value === "visible" ? "on" : value),
  z.enum(["off", "on"] satisfies ReadonlyArray<FeatureModeContract>),
);

const featureOrderSchema = z
  .number()
  .int()
  .optional()
  .describe(
    "Override the side-menu display position for this feature. Lower numbers appear first.",
  );

export const FeatureCommandPaletteSchema = z.object({
  mode: featureModeSchema.optional(),
  order: featureOrderSchema,
});

export const FeatureWorkspaceSchema = z.object({
  mode: featureModeSchema.optional(),
  order: featureOrderSchema,
});

export const FeatureNotificationOverviewSchema = z.object({
  mode: featureModeSchema.optional(),
  order: featureOrderSchema,
  overview: z
    .object({
      max_items: z.number().int().min(0).optional(),
    })
    .optional(),
});

export const FeatureSearchSchema = z.object({
  mode: featureModeSchema.optional(),
  order: featureOrderSchema,
});

export const FeatureGitSchema = z.object({
  mode: featureModeSchema.optional(),
  order: featureOrderSchema,
});

export const FeatureCodingAgentsSchema = z.object({
  mode: featureModeSchema.optional(),
  order: featureOrderSchema,
  notifications: z
    .object({
      working: z
        .object({
          enabled: z.boolean().optional().describe("Notify when an agent starts working."),
        })
        .optional(),
      question: z
        .object({
          enabled: z
            .boolean()
            .optional()
            .describe("Notify when an agent has a question and needs input."),
        })
        .optional(),
      ready: z
        .object({
          enabled: z.boolean().optional().describe("Notify when an agent becomes ready/idle."),
        })
        .optional(),
      error: z
        .object({
          enabled: z.boolean().optional().describe("Notify when an agent reports an error."),
        })
        .optional(),
    })
    .optional(),
});
