import { z } from "zod";
import { FeatureModeContract } from "./feature-mode.contract";

export const hexColorSchema = z.preprocess(
  (val) => (typeof val === "string" && val.startsWith("#") ? val.slice(1) : val),
  z
    .string()
    .regex(
      /^(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/,
      "Must be a 4-, 6-, or 8-digit hex color",
    ),
);

export const featureModeSchema = z.enum([
  "off",
  "hidden",
  "visible",
] satisfies ReadonlyArray<FeatureModeContract>);

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

const aiProviderTypeSchema = z.enum(["openai_compatible", "ollama_native"] as const);

const aiFeatureModeSchema = z.enum(["off", "hidden", "visible"]);

const aiProviderSchema = z.object({
  type: aiProviderTypeSchema,
  base_url: z.string().optional(),
  model: z.string().optional(),
  api_key: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  enabled: z.boolean().optional(),
  auto_detected: z.boolean().optional(),
});

export const FeatureGitSchema = z.object({
  mode: aiFeatureModeSchema.optional(),
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

export const FeatureAiSchema = z.object({
  mode: aiFeatureModeSchema.optional(),
  order: featureOrderSchema,
  active_provider: z.string().optional(),
  resume_pattern: z
    .string()
    .optional()
    .describe(
      "Regex pattern (source only, no flags) to detect AI CLI resume commands in terminal output.",
    ),
  providers: z.record(z.string(), aiProviderSchema).optional(),
  request: z
    .object({
      include_process_tree: z.boolean().optional(),
      max_commands: z.number().int().min(0).optional(),
      max_output_chars: z.number().int().min(0).optional(),
    })
    .optional(),
});
