/** Lines shown on an agent card are cut here; the full text lives in the tooltip. */
const DETAIL_MAX_LENGTH = 120;
/** Prefix of the marker the hook command sends in place of a payload it could not pass on. */
const OMITTED_PAYLOAD_PREFIX = "omitted:";

export type PayloadFields = Readonly<Record<string, unknown>>;

/** The payload as an object, or undefined when the hook sent a marker or nothing usable. */
export function payloadFields(payload: unknown): PayloadFields | undefined {
  if (typeof payload === "string") {
    if (payload.startsWith(OMITTED_PAYLOAD_PREFIX)) {
      console.warn(`[coding-agent] hook payload not available: ${payload}`);
    }
    return undefined;
  }
  if (!payload || typeof payload !== "object") return undefined;
  return payload as PayloadFields;
}

/** The first non-empty line of a string field, cut to card length. */
export function firstLine(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const line = value.trim().split("\n")[0]?.trim() ?? "";
  if (!line) return undefined;
  return line.length > DETAIL_MAX_LENGTH ? `${line.slice(0, DETAIL_MAX_LENGTH - 1)}…` : line;
}

export function stringField(fields: PayloadFields | undefined, key: string): string | undefined {
  const value = fields?.[key];
  return typeof value === "string" && value ? value : undefined;
}

/**
 * A tool call as "Tool: what it does". The tool's own description beats its raw
 * arguments: "Bash: Install dependencies" says more than the command line.
 */
export function describeToolCall(fields: PayloadFields | undefined): string | undefined {
  const toolInput = fields?.["tool_input"];
  const input =
    toolInput && typeof toolInput === "object" ? (toolInput as PayloadFields) : undefined;
  const text = firstLine(
    input?.["description"] ?? input?.["command"] ?? input?.["file_path"] ?? input?.["pattern"],
  );
  if (!text) return undefined;
  const toolName = stringField(fields, "tool_name");
  return toolName ? `${toolName}: ${text}` : text;
}
