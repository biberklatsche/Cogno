const ESCAPES: Readonly<Record<string, string>> = {
  e: "\x1b",
  r: "\r",
  n: "\n",
  t: "\t",
  "\\": "\\",
};

/**
 * The text a `send_text` keybinding writes: `\xHH` is the byte with that hex
 * code, `\e` escape, `\r` enter, `\n` line feed, `\t` tab and `\\` a backslash.
 * Any other backslash stays as written.
 */
export function decodeSendTextEscapes(text: string): string {
  return text.replace(/\\(?:x([0-9A-Fa-f]{2})|([ernt\\]))/g, (_match, hex, name) =>
    hex ? String.fromCharCode(Number.parseInt(hex, 16)) : ESCAPES[name],
  );
}
