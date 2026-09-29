import { FeatureModeContract } from "@cogno/shared/domain";
import { z } from "zod";
import { limitSchema } from "./limit-setting";

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

/** Shared description for every feature's on/off switch. */
const featureModeDescription =
  "Turn the feature on or off. Off removes it entirely, including its side-menu entry and actions.";

const featureOrderSchema = z
  .number()
  .int()
  .optional()
  .describe(
    "Override the side-menu display position for this feature. Lower numbers appear first.",
  );

export const FeatureCommandPaletteSchema = z.strictObject({
  mode: featureModeSchema.optional().describe(featureModeDescription),
  order: featureOrderSchema,
});

export const FeatureWorkspaceSchema = z.strictObject({
  mode: featureModeSchema.optional().describe(featureModeDescription),
  order: featureOrderSchema,
});

export const FeatureNotificationOverviewSchema = z.strictObject({
  mode: featureModeSchema.optional().describe(featureModeDescription),
  order: featureOrderSchema,
  overview: z
    .strictObject({
      max_items: limitSchema()
        .optional()
        .describe("How many notifications the overview keeps, or `unlimited`."),
    })
    .optional()
    .describe("The notification overview panel."),
});

export const FeatureSearchSchema = z.strictObject({
  mode: featureModeSchema.optional().describe(featureModeDescription),
  order: featureOrderSchema,
});

export const FeatureGitSchema = z.strictObject({
  mode: featureModeSchema.optional().describe(featureModeDescription),
  order: featureOrderSchema,
});

export const FeatureProcessInfoSchema = z.strictObject({
  mode: featureModeSchema.optional().describe(featureModeDescription),
  order: featureOrderSchema,
});

export const FeatureCodingAgentsSchema = z.strictObject({
  mode: featureModeSchema.optional().describe(featureModeDescription),
  order: featureOrderSchema,
  notifications: z
    .strictObject({
      working: z
        .strictObject({
          enabled: z.boolean().optional().describe("Notify when an agent starts working."),
        })
        .optional(),
      question: z
        .strictObject({
          enabled: z
            .boolean()
            .optional()
            .describe("Notify when an agent has a question and needs input."),
        })
        .optional(),
      ready: z
        .strictObject({
          enabled: z.boolean().optional().describe("Notify when an agent becomes ready/idle."),
        })
        .optional(),
      error: z
        .strictObject({
          enabled: z.boolean().optional().describe("Notify when an agent reports an error."),
        })
        .optional(),
    })
    .optional()
    .describe("Which coding-agent state changes raise a notification."),
});
