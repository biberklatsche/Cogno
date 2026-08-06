import { ShellInsertSanitizerContract } from "@cogno/core-api";

const WHITESPACE = new Set([" ", "\t"]);

/**
 * Removes backslash-newline line continuations the way a POSIX-style shell
 * itself would, so inserted commands stay inside the single-line editing
 * model:
 *
 * - Outside quotes, the continuation plus its surrounding indentation is an
 *   argument separator and collapses to a single space; a mid-token
 *   continuation (no surrounding whitespace) is joined with nothing, exactly
 *   like the shell does.
 * - Inside double quotes the continuation is removed but surrounding
 *   whitespace is significant and preserved.
 * - Inside single quotes backslash and newline are literal characters — no
 *   continuation exists there, the text is left untouched.
 *
 * Unescaped newlines (loops, heredocs) are preserved. The cursor index is
 * mapped through the removals.
 */
function flattenLineContinuations(
  text: string,
  cursorIndex: number,
): { text: string; cursorIndex: number } {
  if (!text.includes("\n")) {
    return { text, cursorIndex };
  }

  let result = "";
  let removedBeforeCursor = 0;
  let cursorPinned: number | null = null;
  let quote: "'" | '"' | null = null;
  // Text index where the last continuation region ended; the backward
  // whitespace walk must not cross it, because earlier characters in `result`
  // may be a replacement space rather than verbatim input.
  let lastRegionEnd = 0;
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (quote === "'") {
      if (char === "'") quote = null;
      result += char;
      i++;
      continue;
    }

    if (char === "\\") {
      const isCrlf = text[i + 1] === "\r" && text[i + 2] === "\n";
      const isLf = text[i + 1] === "\n";
      if (!isLf && !isCrlf) {
        // Escaped character (including \\): copy the pair verbatim.
        result += char;
        i++;
        if (i < text.length) {
          result += text[i];
          i++;
        }
        continue;
      }

      const afterNewline = i + (isCrlf ? 3 : 2);

      if (quote === '"') {
        // Whitespace is significant inside double quotes: drop only the
        // backslash-newline itself.
        if (cursorIndex >= afterNewline) {
          removedBeforeCursor += afterNewline - i;
        } else if (cursorIndex > i && cursorPinned === null) {
          cursorPinned = result.length;
        }
        lastRegionEnd = afterNewline;
        i = afterNewline;
        continue;
      }

      // Outside quotes: whitespace around the continuation is an argument
      // separator — collapse it to one space. Without surrounding whitespace
      // the continuation splits a token and is joined with nothing.
      let whitespaceBefore = 0;
      while (
        i - 1 - whitespaceBefore >= lastRegionEnd &&
        WHITESPACE.has(text[i - 1 - whitespaceBefore])
      ) {
        whitespaceBefore++;
      }
      let regionEnd = afterNewline;
      while (regionEnd < text.length && WHITESPACE.has(text[regionEnd])) {
        regionEnd++;
      }
      const regionStart = i - whitespaceBefore;
      const separator = whitespaceBefore > 0 || regionEnd > afterNewline ? " " : "";
      result = result.slice(0, result.length - whitespaceBefore) + separator;

      if (cursorIndex >= regionEnd) {
        removedBeforeCursor += regionEnd - regionStart - separator.length;
      } else if (cursorIndex > regionStart && cursorPinned === null) {
        cursorPinned = result.length;
      }
      lastRegionEnd = regionEnd;
      i = regionEnd;
      continue;
    }

    if (quote === null) {
      if (char === "'") quote = "'";
      else if (char === '"') quote = '"';
    } else if (quote === '"' && char === '"') {
      quote = null;
    }
    result += char;
    i++;
  }

  const mappedCursor =
    cursorPinned ?? Math.max(0, Math.min(cursorIndex - removedBeforeCursor, result.length));
  return { text: result, cursorIndex: mappedCursor };
}

/**
 * Insert sanitizer shared by the POSIX-style shells (bash, zsh, fish): they
 * agree on backslash-newline continuation and quoting semantics. Remaining
 * real newlines (loops, heredocs) are wrapped in bracketed paste so the shell
 * inserts them into the edit buffer literally instead of treating each one as
 * accept-line and executing the lines one by one.
 */
export const posixInsertSanitizer: ShellInsertSanitizerContract = {
  prepareInsert: flattenLineContinuations,
  wrapForPtyWrite: (text: string) => (text.includes("\n") ? `\x1b[200~${text}\x1b[201~` : text),
};
