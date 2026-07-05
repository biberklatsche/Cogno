import { describe, expect, it } from "vitest";
import { posixInsertSanitizer } from "./posix-insert-sanitizer";

describe("posixInsertSanitizer", () => {
  describe("prepareInsert", () => {
    it("collapses a whitespace-surrounded continuation to a single space", () => {
      const { text } = posixInsertSanitizer.prepareInsert(
        "node cli.mjs check \\\n    --input ./data.con \\\n    --format kvdt",
        0,
      );
      expect(text).toBe("node cli.mjs check --input ./data.con --format kvdt");
    });

    it("joins a mid-token continuation with nothing, like the shell does", () => {
      const { text } = posixInsertSanitizer.prepareInsert("curl https://host/long\\\npath", 0);
      expect(text).toBe("curl https://host/longpath");
    });

    it("preserves significant whitespace inside double quotes", () => {
      const { text } = posixInsertSanitizer.prepareInsert('echo "x  \\\n  y"', 0);
      expect(text).toBe('echo "x    y"');
    });

    it("leaves single-quoted backslash-newline untouched (no continuation there)", () => {
      const input = "echo 'a\\\nb'";
      const { text } = posixInsertSanitizer.prepareInsert(input, 0);
      expect(text).toBe(input);
    });

    it("does not treat a single quote inside double quotes as a quote opener", () => {
      const { text } = posixInsertSanitizer.prepareInsert('echo "it\'s a \\\n test"', 0);
      expect(text).toBe('echo "it\'s a  test"');
    });

    it("keeps an escaped backslash and the following real newline", () => {
      const input = "echo foo\\\\\ndone";
      const { text } = posixInsertSanitizer.prepareInsert(input, 0);
      expect(text).toBe(input);
    });

    it("handles CRLF continuations", () => {
      const { text } = posixInsertSanitizer.prepareInsert("echo a \\\r\n    b", 0);
      expect(text).toBe("echo a b");
    });

    it("maps a cursor at the end of the text to the end of the result", () => {
      const input = "echo a \\\n    b";
      const { text, cursorIndex } = posixInsertSanitizer.prepareInsert(input, input.length);
      expect(text).toBe("echo a b");
      expect(cursorIndex).toBe(text.length);
    });

    it("pins a cursor inside a removed continuation to the join point", () => {
      const input = "echo a \\\n    b";
      // Cursor inside the indentation of the second line.
      const { text, cursorIndex } = posixInsertSanitizer.prepareInsert(input, 11);
      expect(text).toBe("echo a b");
      expect(cursorIndex).toBe("echo a ".length);
    });

    it("preserves unescaped newlines (loops, heredocs)", () => {
      const input = "for f in *.txt\ndo\n  echo $f\ndone";
      const { text } = posixInsertSanitizer.prepareInsert(input, 0);
      expect(text).toBe(input);
    });
  });

  describe("wrapForPtyWrite", () => {
    it("wraps text containing newlines in bracketed paste markers", () => {
      expect(posixInsertSanitizer.wrapForPtyWrite("a\nb")).toBe("\x1b[200~a\nb\x1b[201~");
    });

    it("returns single-line text unchanged", () => {
      expect(posixInsertSanitizer.wrapForPtyWrite("echo a")).toBe("echo a");
    });
  });
});
