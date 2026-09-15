import { z } from "zod";
import { HexColorSchema, TerminalNamedColorSchema } from "./shared";

/**
 * Recommendation:
 * - prompt.active = "default"
 * - prompt.profile.<profileName>.order = "user,at,machine"
 * - prompt.profile.<profileName>.default_separator = "" (optional)
 * - prompt.segment.<segmentName>.<props...>
 *
 * After your key=value parser, you should end up with something like:
 *
 * {
 *   prompt: {
 *     active: "default",
 *     profile: {
 *       default: { order: ["user","at","machine"], default_separator: "" },
 *       minimal: { order: ["user","machine"] }
 *     },
 *     segment: {
 *       user: { field: "user", foreground: "green", bold: true, separator: "" },
 *       at: { text: "@", foreground: "brightBlack" },
 *       machine: { field: "machine", foreground: "red" }
 *     }
 *   }
 * }
 */

/* ----------------------------- colors ----------------------------- */
export const PromptColorSchema = z.union([TerminalNamedColorSchema, HexColorSchema]);

/* ---------------------------- segments ---------------------------- */

export const PromptFormatSchema = z.union([
  z.literal("string"),
  z.literal("number"),
  z.literal("json"),
  z.literal("upper"),
  z.literal("lower"),
  z.literal("timespan"),
]);

/**
 * Keep `when` as string here, because in key=value it will typically be:
 *   prompt.segment.return_code.when = returnCode!=0
 *
 * You can later replace this with a parsed ConditionExpression schema.
 */
export const WhenExpressionSchema = z.string().min(1);

const SegmentCommonSchema = z
  .object({
    foreground: PromptColorSchema.optional().describe(
      "Text colour: a terminal colour name or hex.",
    ),
    background: PromptColorSchema.optional().describe(
      "Background colour: a terminal colour name or hex.",
    ),

    bold: z.boolean().optional().describe("Render the segment bold."),
    italic: z.boolean().optional().describe("Render the segment italic."),
    underline: z.boolean().optional().describe("Underline the segment."),
    size: z.number().int().min(1).optional().describe("Font size override for this segment."),

    when: WhenExpressionSchema.optional().describe(
      "Only show the segment when the condition holds, e.g. `returnCode!=0`.",
    ),

    padding_left: z.number().int().optional().describe("Inner padding left of the content."),
    padding_right: z.number().int().optional().describe("Inner padding right of the content."),
    margin_left: z.number().int().optional().describe("Outer margin left of the segment."),
    margin_right: z.number().int().optional().describe("Outer margin right of the segment."),
    radius_left: z.number().int().min(0).optional().describe("Corner radius on the left side."),
    radius_right: z.number().int().min(0).optional().describe("Corner radius on the right side."),

    title: z.string().optional().describe("Tooltip shown when hovering the segment."),
    className: z.string().optional().describe("Extra CSS class for custom styling."),

    format: PromptFormatSchema.optional().describe(
      "How the value is rendered, e.g. `timespan` for a duration.",
    ),
    fallback: z.string().optional().describe("Shown when the field has no value."),
  })
  .strict();

export const FieldSegmentSchema = SegmentCommonSchema.extend({
  field: z
    .string()
    .min(1)
    .describe("Data field to display, e.g. `directory`, `user`, `machine`, `duration`."),
}).strict();

export const TextSegmentSchema = SegmentCommonSchema.extend({
  text: z.string().describe("Static text to display, instead of a `field`."),
}).strict();

/**
 * Exactly one of field or text.
 */
export const PromptSegmentSchema = z
  .union([FieldSegmentSchema, TextSegmentSchema])
  .superRefine((value, context) => {
    const hasField = "field" in value;
    const hasText = "text" in value;

    if (hasField && hasText) {
      context.addIssue({
        code: "custom",
        message: 'Segment must not contain both "field" and "text".',
      });
    }

    if (!hasField && !hasText) {
      context.addIssue({
        code: "custom",
        message: 'Segment must contain exactly one of "field" or "text".',
      });
    }
  });

/* ---------------------------- profiles ---------------------------- */

export const PromptProfileSchema = z
  .object({
    order: z
      .array(z.string().min(1))
      .min(1)
      .describe("Segment names to render, in order; each must exist under `prompt.segment`."),
    default_separator: z.string().optional().describe("Text inserted between segments."),
  })
  .strict();

/* ------------------------------ root ------------------------------ */

export const PromptConfigSchema = z
  .object({
    active: z.string().min(1).describe("Name of the prompt profile in use."),
    profile: z
      .record(z.string().min(1), PromptProfileSchema)
      .describe("Named prompt profiles; each lists the segments it renders."),
    segment: z
      .record(z.string().min(1), PromptSegmentSchema)
      .describe("Named segments a profile can reference."),
  })
  .strict()
  .superRefine((value, context) => {
    // active profile must exist
    if (!value.profile[value.active]) {
      context.addIssue({
        code: "custom",
        path: ["active"],
        message: `Active prompt profile "${value.active}" is not defined under prompt.profile.*`,
      });
      return;
    }

    // every name referenced in each profile order must exist as a segment
    for (const [profileName, profile] of Object.entries(value.profile)) {
      for (const segmentName of profile.order) {
        if (!value.segment[segmentName]) {
          context.addIssue({
            code: "custom",
            path: ["profile", profileName, "order"],
            message: `Profile "${profileName}" references missing segment "${segmentName}" under prompt.segment.*`,
          });
        }
      }
    }
  });

/* ------------------------------ types ----------------------------- */

export type PromptSegment = z.infer<typeof PromptSegmentSchema>;
export type PromptProfile = z.infer<typeof PromptProfileSchema>;
export type PromptConfig = z.infer<typeof PromptConfigSchema>;
