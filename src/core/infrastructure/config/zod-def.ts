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

/** The `.meta()` of a schema and of the wrappers around it; an outer wrapper wins. */
export function zodMeta(schema: z.ZodType | undefined): Readonly<Record<string, unknown>> {
  const layers: Record<string, unknown>[] = [];
  let current = schema;
  for (let guard = 0; guard < 10 && current; guard++) {
    const meta = (current as { meta?: () => Record<string, unknown> | undefined }).meta?.();
    if (meta) layers.unshift(meta);
    current = zodDef(current)?.innerType;
  }
  return Object.assign({}, ...layers);
}

/**
 * Marks a list whose lines add to the defaults instead of replacing them
 * (`keybind`). The reader merges such a list, the panel leaves it to the file.
 */
export const ADDITIVE_LIST = { additive: true } as const;

export function isAdditiveList(schema: z.ZodType | undefined): boolean {
  return zodMeta(schema)["additive"] === true;
}

/**
 * What a user-chosen key of a map is called in the reference and the panel:
 * `<name>` unless the map says otherwise, `<var>` for environment variables.
 */
export const RECORD_OF_VARIABLES = { placeholder: "<var>" } as const;

export function recordPlaceholder(schema: z.ZodType | undefined): string {
  const placeholder = zodMeta(schema)["placeholder"];
  return typeof placeholder === "string" ? placeholder : "<name>";
}
