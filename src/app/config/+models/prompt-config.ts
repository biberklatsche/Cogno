import { z } from 'zod';
import {HexColorSchema, TerminalNamedColorSchema} from "./shared";

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
    z.literal('string'),
    z.literal('number'),
    z.literal('json'),
    z.literal('upper'),
    z.literal('lower'),
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
        foreground: PromptColorSchema.optional(),
        background: PromptColorSchema.optional(),

        bold: z.boolean().optional(),
        dim: z.boolean().optional(),
        italic: z.boolean().optional(),
        underline: z.boolean().optional(),

        separator: z.string().optional(),

        when: WhenExpressionSchema.optional(),

        title: z.string().optional(),
        className: z.string().optional(),

        format: PromptFormatSchema.optional(),
        fallback: z.string().optional(),
    })
    .strict();

export const FieldSegmentSchema = SegmentCommonSchema.extend({
    field: z.string().min(1),
}).strict();

export const TextSegmentSchema = SegmentCommonSchema.extend({
    text: z.string(),
}).strict();

/**
 * Exactly one of field or text.
 */
export const PromptSegmentSchema = z
    .union([FieldSegmentSchema, TextSegmentSchema])
    .superRefine((value, context) => {
        const hasField = 'field' in value;
        const hasText = 'text' in value;

        if (hasField && hasText) {
            context.addIssue({
                code: 'custom',
                message: 'Segment must not contain both "field" and "text".',
            });
        }

        if (!hasField && !hasText) {
            context.addIssue({
                code: 'custom',
                message: 'Segment must contain exactly one of "field" or "text".',
            });
        }
    });

/* ---------------------------- profiles ---------------------------- */

export const PromptProfileSchema = z
    .object({
        order: z.array(z.string().min(1)).min(1),
        default_separator: z.string().optional(),
    })
    .strict();

/* ------------------------------ root ------------------------------ */

export const PromptConfigSchema = z
    .object({
        active: z.string().min(1),
        profile: z.record(z.string().min(1), PromptProfileSchema),
        segment: z.record(z.string().min(1), PromptSegmentSchema),
    })
    .strict()
    .superRefine((value, context) => {
        // active profile must exist
        if (!value.profile[value.active]) {
            context.addIssue({
                code: 'custom',
                path: ['active'],
                message: `Active prompt profile "${value.active}" is not defined under prompt.profile.*`,
            });
            return;
        }

        // every name referenced in each profile order must exist as a segment
        for (const [profileName, profile] of Object.entries(value.profile)) {
            for (const segmentName of profile.order) {
                if (!value.segment[segmentName]) {
                    context.addIssue({
                        code: 'custom',
                        path: ['profile', profileName, 'order'],
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

