import type { IBufferCell } from "@xterm/xterm";
import { describe, expect, it } from "vitest";
import {
  type SerializableBuffer,
  type SerializableLine,
  serializeScrollback,
} from "./scrollback-serializer";

interface CellOptions {
  width?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  inverse?: boolean;
  invisible?: boolean;
  fg?: number;
  bg?: number;
  fgRgb?: boolean;
  bgRgb?: boolean;
}

function cell(char: string, o: CellOptions = {}): IBufferCell {
  return {
    getChars: () => char,
    getWidth: () => o.width ?? (char.length > 0 ? 1 : 0),
    isBold: () => (o.bold ? 1 : 0),
    isDim: () => 0,
    isItalic: () => (o.italic ? 1 : 0),
    isUnderline: () => (o.underline ? 1 : 0),
    isBlink: () => 0,
    isInverse: () => (o.inverse ? 1 : 0),
    isInvisible: () => (o.invisible ? 1 : 0),
    isStrikethrough: () => 0,
    isOverline: () => 0,
    isFgDefault: () => o.fg === undefined,
    isBgDefault: () => o.bg === undefined,
    isFgRGB: () => o.fgRgb === true,
    isBgRGB: () => o.bgRgb === true,
    getFgColor: () => o.fg ?? -1,
    getBgColor: () => o.bg ?? -1,
  } as unknown as IBufferCell;
}

function line(cells: IBufferCell[]): SerializableLine {
  return { length: cells.length, getCell: (index) => cells[index] };
}

function cellsOf(text: string, o: CellOptions = {}): IBufferCell[] {
  return [...text].map((char) => cell(char, o));
}

function buffer(lines: SerializableLine[]): SerializableBuffer {
  return { length: lines.length, getLine: (index) => lines[index] };
}

describe("serializeScrollback", () => {
  it("emits plain text, trims trailing spaces, resets at the end", () => {
    const buf = buffer([line([...cellsOf("hi"), cell(" "), cell(" ")])]);

    expect(serializeScrollback(buf, 0, 1)).toBe("hi\x1b[0m");
  });

  it("returns empty string for an all-blank range", () => {
    const buf = buffer([line(cellsOf("   ")), line([])]);

    expect(serializeScrollback(buf, 0, 2)).toBe("");
  });

  it("encodes a low-palette foreground colour", () => {
    const buf = buffer([line(cellsOf("err", { fg: 1 }))]);

    expect(serializeScrollback(buf, 0, 1)).toBe("\x1b[0;31merr\x1b[0m");
  });

  it("encodes a bright-palette and 256-colour foreground", () => {
    const buf = buffer([line([cell("a", { fg: 9 }), cell("b", { fg: 200 })])]);

    expect(serializeScrollback(buf, 0, 1)).toBe("\x1b[0;91ma\x1b[0;38;5;200mb\x1b[0m");
  });

  it("encodes a truecolor foreground", () => {
    const buf = buffer([line(cellsOf("x", { fg: 0xff8800, fgRgb: true }))]);

    expect(serializeScrollback(buf, 0, 1)).toBe("\x1b[0;38;2;255;136;0mx\x1b[0m");
  });

  it("combines attributes with foreground in one sequence", () => {
    const buf = buffer([line(cellsOf("B", { bold: true, fg: 4 }))]);

    expect(serializeScrollback(buf, 0, 1)).toBe("\x1b[0;1;34mB\x1b[0m");
  });

  it("keeps a concealed marker line invisible via SGR 8", () => {
    const buf = buffer([line(cellsOf("^^#42", { invisible: true }))]);

    expect(serializeScrollback(buf, 0, 1)).toBe("\x1b[0;8m^^#42\x1b[0m");
  });

  it("does not repeat the sequence while the style is unchanged", () => {
    const buf = buffer([line(cellsOf("red", { fg: 1 }))]);

    expect(serializeScrollback(buf, 0, 1)).toBe("\x1b[0;31mred\x1b[0m");
  });

  it("resets back to default when the style ends mid-line", () => {
    const buf = buffer([line([cell("r", { fg: 1 }), cell("d")])]);

    expect(serializeScrollback(buf, 0, 1)).toBe("\x1b[0;31mr\x1b[0md\x1b[0m");
  });

  it("keeps a coloured trailing blank but trims default padding after it", () => {
    const buf = buffer([line([cell("x"), cell(" ", { bg: 2 }), cell(" "), cell(" ")])]);

    expect(serializeScrollback(buf, 0, 1)).toBe("x\x1b[0;42m \x1b[0m");
  });

  it("joins lines with CRLF and drops trailing blank lines", () => {
    const buf = buffer([line(cellsOf("one")), line(cellsOf("two")), line(cellsOf("  "))]);

    expect(serializeScrollback(buf, 0, 3)).toBe("one\r\ntwo\x1b[0m");
  });

  it("skips the spacer cell after a wide glyph", () => {
    const buf = buffer([line([cell("世", { width: 2 }), cell("", { width: 0 }), cell("!")])]);

    expect(serializeScrollback(buf, 0, 1)).toBe("世!\x1b[0m");
  });
});
