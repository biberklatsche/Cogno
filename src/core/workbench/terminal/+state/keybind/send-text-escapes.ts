const ESCAPES: Readonly<Record<string, string>> = {
  e: "\x1b",
  r: "\r",
  n: "\n",
  t: "\t",
  "\\": "\\",
};

/**
 * The text a `send_text` keybinding writes: `\xHH` is the ASCII character with
 * that hex code (`00` to `7F` - text reaches the shell as UTF-8, so nothing above
 * would arrive as one byte), `\e` escape, `\r` enter, `\n` line feed, `\t` tab
 * and `\\` a backslash. Any other backslash stays as written.
 */
export function decodeSendTextEscapes(text: string): string {
  return text.replace(/\\(?:x([0-7][0-9A-Fa-f])|([ernt\\]))/g, (_match, hex, name) =>
    hex ? String.fromCharCode(Number.parseInt(hex, 16)) : ESCAPES[name],
  );
}
