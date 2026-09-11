import type { IBufferCell } from "@xterm/xterm";

/**
 * Minimal buffer for the serializer: enough of xterm's IBuffer to read a range
 * of lines and their cells. Kept narrow so the serializer is a pure function
 * that can be unit-tested with plain fakes (no DOM, no addon).
 */
export interface SerializableBuffer {
  readonly length: number;
  getLine(index: number): SerializableLine | undefined;
}

export interface SerializableLine {
  readonly length: number;
  getCell(column: number): IBufferCell | undefined;
}

const ESC = "\x1b[";
const RESET = `${ESC}0m`;

/**
 * Serialize a range of buffer lines to text with SGR escapes - colours and
 * attributes preserved, but NO cursor/mode/OSC sequences (unlike SerializeAddon,
 * whose cursor-restore tail corrupted the live session on replay). The output is
 * `\r\n`-separated visual lines, so it replays width-independently, and trailing
 * blank lines are trimmed. Concealed marker lines (`\e[8m^^#<id>`) are kept as
 * such - their invisibility rides along in the SGR (step 27).
 */
export function serializeScrollback(
  buffer: SerializableBuffer,
  beginLine: number,
  endLine: number,
): string {
  const lines: string[] = [];
  let sgrSignature = "";

  for (let lineIndex = beginLine; lineIndex < endLine; lineIndex++) {
    const line = buffer.getLine(lineIndex);
    if (!line) {
      lines.push("");
      continue;
    }
    const result = serializeLine(line, sgrSignature);
    sgrSignature = result.sgrSignature;
    lines.push(result.text);
  }

  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  if (lines.length === 0) return "";

  return `${lines.join("\r\n")}${RESET}`;
}

function serializeLine(
  line: SerializableLine,
  incomingSignature: string,
): { text: string; sgrSignature: string } {
  const lastSignificant = lastSignificantColumn(line);
  if (lastSignificant < 0) {
    // A blank line resets nothing visible; keep the incoming SGR so the next
    // line continues where the previous non-blank one left off.
    return { text: "", sgrSignature: incomingSignature };
  }

  let text = "";
  let signature = incomingSignature;
  for (let column = 0; column <= lastSignificant; column++) {
    const cell = line.getCell(column);
    if (!cell) continue;
    const width = cell.getWidth();
    if (width === 0) continue; // trailing cell of a wide glyph

    const cellSignature = sgrParams(cell);
    if (cellSignature !== signature) {
      text += cellSignature.length > 0 ? `${ESC}0;${cellSignature}m` : RESET;
      signature = cellSignature;
    }
    const chars = cell.getChars();
    text += chars.length > 0 ? chars : " ";
  }
  return { text, sgrSignature: signature };
}

/**
 * The last column that carries something worth keeping: a non-space glyph or a
 * non-default background (a coloured blank still matters). Everything past it is
 * default padding and gets trimmed.
 */
function lastSignificantColumn(line: SerializableLine): number {
  for (let column = line.length - 1; column >= 0; column--) {
    const cell = line.getCell(column);
    if (!cell) continue;
    if (cell.getWidth() === 0) continue;
    const chars = cell.getChars();
    const isBlankGlyph = chars.length === 0 || chars === " ";
    if (!isBlankGlyph || !cell.isBgDefault()) return column;
  }
  return -1;
}

/** The SGR parameter list (without the leading reset) for a cell's attributes. */
function sgrParams(cell: IBufferCell): string {
  const params: string[] = [];

  if (cell.isBold()) params.push("1");
  if (cell.isDim()) params.push("2");
  if (cell.isItalic()) params.push("3");
  if (cell.isUnderline()) params.push("4");
  if (cell.isBlink()) params.push("5");
  if (cell.isInverse()) params.push("7");
  if (cell.isInvisible()) params.push("8");
  if (cell.isStrikethrough()) params.push("9");
  if (cell.isOverline()) params.push("53");

  appendColor(params, cell, "fg");
  appendColor(params, cell, "bg");

  return params.join(";");
}

function appendColor(params: string[], cell: IBufferCell, layer: "fg" | "bg"): void {
  const isDefault = layer === "fg" ? cell.isFgDefault() : cell.isBgDefault();
  if (isDefault) return;

  const isRgb = layer === "fg" ? cell.isFgRGB() : cell.isBgRGB();
  const color = layer === "fg" ? cell.getFgColor() : cell.getBgColor();
  const baseExtended = layer === "fg" ? 38 : 48;
  const baseLow = layer === "fg" ? 30 : 40;
  const baseHigh = layer === "fg" ? 90 : 100;

  if (isRgb) {
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    params.push(`${baseExtended};2;${r};${g};${b}`);
    return;
  }

  // Palette colour: 0-7 low, 8-15 bright, 16-255 the 256-colour cube.
  if (color < 8) {
    params.push(`${baseLow + color}`);
  } else if (color < 16) {
    params.push(`${baseHigh + color - 8}`);
  } else {
    params.push(`${baseExtended};5;${color}`);
  }
}
