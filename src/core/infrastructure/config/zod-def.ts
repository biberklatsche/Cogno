import { z } from "zod";

type ZodCheckDef = { check?: string; value?: number; inclusive?: boolean };

/**
 * The fields of a Zod 4 definition (`schema._zod.def`) the config code reads:
 * the mapper to parse a line against the schema at its key, the docs generator
 * to describe each setting. Everything else stays unknown on purpose.
 */
export type ZodDef = {
  readonly type: string;
  readonly shape?: Record<string, z.ZodType>;
  readonly innerType?: z.ZodType;
  readonly valueType?: z.ZodType;
  readonly element?: z.ZodType;
  readonly options?: ReadonlyArray<z.ZodType>;
  readonly entries?: Record<string, string>;
  readonly values?: ReadonlyArray<unknown>;
  readonly out?: z.ZodType;
  readonly checks?: ReadonlyArray<{ _zod?: { def?: ZodCheckDef } } & ZodCheckDef>;
};

export function zodDef(schema: z.ZodType | undefined): ZodDef | undefined {
  return schema?._zod.def as ZodDef | undefined;
}

/** The schema under its `optional`/`default` wrappers. */
export function unwrapZod(schema: z.ZodType | undefined): z.ZodType | undefined {
  let current = schema;
  for (let inner = zodDef(current)?.innerType; inner; inner = zodDef(current)?.innerType) {
    current = inner;
  }
  return current;
}
