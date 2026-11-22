/**
 * How long a cursor position the editor expects stays valid after the last
 * move it sent. Long enough for the shell's echo on a slow connection; short
 * enough that a move the shell refused (at the end of the line, in vi mode)
 * is not built on for long.
 */
export const EXPECTED_CURSOR_TTL_MS = 1000;

type Expectation = {
  /** Where the cursor will be. */
  readonly index: number;
  /** Where the shell had reported the cursor when the first move was sent. */
  readonly base: number;
  readonly expiresAt: number;
};

/**
 * Where the cursor of the input line will be once the shell has carried out
 * every cursor move the editor sent. The reported position lags behind by one
 * pty round trip - a network round trip over ssh - so an edit that follows
 * quickly (key repeat) must be computed from here, not from the echo.
 *
 * It is not compared against the reports: on the way to the target they pass
 * through positions that may equal it. It ends when its time is up or when
 * something happens the editor did not send as a cursor move.
 */
export class ExpectedCursor {
  private expected?: Expectation;

  /** The editor sent moves that end at `index`; the shell reports `reportedIndex` so far. */
  expect(index: number, reportedIndex: number): void {
    const base = this.live()?.base ?? reportedIndex;
    this.expected = { index, base, expiresAt: performance.now() + EXPECTED_CURSOR_TTL_MS };
  }

  /** The line changed in a way the editor did not send as a cursor move. */
  discard(): void {
    this.expected = undefined;
  }

  /**
   * The read text changed while moves are under way. Everything sent after
   * the first move discards, so this is the echo of something typed before
   * it: the moves started one edit further than the editor knew. Typed text
   * and a backspace shift the expectation along; anything else ends it.
   */
  textChanged(previousText: string, text: string): void {
    const expected = this.live();
    if (!expected) return;
    const shift = shiftOfEditAt(expected.base, previousText, text);
    if (shift === undefined) {
      this.expected = undefined;
      return;
    }
    this.expected = {
      ...expected,
      index: Math.max(0, expected.index + shift),
      base: expected.base + shift,
    };
  }

  /** The position to edit from: the expected one while it holds, the reported one otherwise. */
  resolve(reportedIndex: number): number {
    return this.live()?.index ?? reportedIndex;
  }

  private live(): Expectation | undefined {
    if (this.expected && performance.now() >= this.expected.expiresAt) this.expected = undefined;
    return this.expected;
  }
}

/**
 * How far an edit at `cursor` moved the cursor: text inserted there moves it
 * right, text removed in front of it (backspace) moves it left. `undefined`
 * for every other change.
 */
function shiftOfEditAt(cursor: number, previousText: string, text: string): number | undefined {
  const grown = text.length - previousText.length;
  if (grown > 0) {
    const inserted =
      text.slice(0, cursor) === previousText.slice(0, cursor) &&
      text.slice(cursor + grown) === previousText.slice(cursor);
    return inserted && cursor <= previousText.length ? grown : undefined;
  }
  if (grown < 0) {
    const start = cursor + grown;
    const removed =
      start >= 0 &&
      cursor <= previousText.length &&
      text.slice(0, start) === previousText.slice(0, start) &&
      text.slice(start) === previousText.slice(cursor);
    return removed ? grown : undefined;
  }
  return undefined;
}
