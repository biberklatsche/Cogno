import { describe, expect, it } from "vitest";
import { decodeSendTextEscapes } from "./send-text-escapes";

describe("decodeSendTextEscapes", () => {
  it("leaves plain text as written", () => {
    expect(decodeSendTextEscapes("npm run test:unit -- --a=b")).toBe("npm run test:unit -- --a=b");
  });

  it("decodes a hex byte", () => {
    expect(decodeSendTextEscapes("\\x03")).toBe("\x03");
    expect(decodeSendTextEscapes("\\x1B[A")).toBe("\x1b[A");
  });

  it("decodes the named escapes", () => {
    expect(decodeSendTextEscapes("ls\\r")).toBe("ls\r");
    expect(decodeSendTextEscapes("\\e\\n\\t")).toBe("\x1b\n\t");
  });

  it("keeps an escaped backslash from starting an escape", () => {
    expect(decodeSendTextEscapes("\\\\x03")).toBe("\\x03");
  });

  it("leaves an unknown or incomplete escape as written", () => {
    expect(decodeSendTextEscapes("C:\\dir \\x4 \\q")).toBe("C:\\dir \\x4 \\q");
  });

  it("leaves a code above ASCII as written: it would not arrive as one byte", () => {
    expect(decodeSendTextEscapes("\\x7f\\x80\\xff")).toBe("\x7f\\x80\\xff");
  });
});
