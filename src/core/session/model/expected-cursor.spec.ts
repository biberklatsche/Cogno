import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EXPECTED_CURSOR_TTL_MS, ExpectedCursor } from "./expected-cursor";

describe("ExpectedCursor", () => {
  let cursor: ExpectedCursor;

  beforeEach(() => {
    vi.useFakeTimers();
    cursor = new ExpectedCursor();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is the reported position while nothing is expected", () => {
    expect(cursor.resolve(4)).toBe(4);
  });

  it("is the expected position, whatever the shell has reported so far", () => {
    cursor.expect(7, 4);

    expect(cursor.resolve(4)).toBe(7);
    expect(cursor.resolve(5)).toBe(7);
    // A report on the way that happens to equal an earlier target settles nothing.
    expect(cursor.resolve(7)).toBe(7);
    expect(cursor.resolve(8)).toBe(7);
  });

  it("is the reported position again once discarded", () => {
    cursor.expect(7, 4);
    cursor.discard();

    expect(cursor.resolve(4)).toBe(4);
  });

  it("gives way to the reported position when the shell did not follow in time", () => {
    cursor.expect(7, 4);

    vi.advanceTimersByTime(EXPECTED_CURSOR_TTL_MS - 1);
    expect(cursor.resolve(4)).toBe(7);

    vi.advanceTimersByTime(1);
    expect(cursor.resolve(4)).toBe(4);
  });

  it("holds on as long as moves keep being sent", () => {
    cursor.expect(1, 0);
    vi.advanceTimersByTime(EXPECTED_CURSOR_TTL_MS - 1);
    cursor.expect(2, 0);
    vi.advanceTimersByTime(EXPECTED_CURSOR_TTL_MS - 1);

    expect(cursor.resolve(0)).toBe(2);
  });

  describe("the echo of something typed before the moves", () => {
    // "hello" with the cursor reported at 5; three moves left expect 2.
    beforeEach(() => cursor.expect(2, 5));

    it("moves along with text typed where the cursor stood", () => {
      cursor.textChanged("hello", "hellox");

      expect(cursor.resolve(6)).toBe(3);
    });

    it("moves along with typed text that arrives in two echoes", () => {
      cursor.textChanged("hello", "hellox");
      cursor.textChanged("hellox", "helloxy");

      expect(cursor.resolve(7)).toBe(4);
    });

    it("moves along with a backspace", () => {
      cursor.textChanged("hello", "hell");

      expect(cursor.resolve(4)).toBe(1);
    });

    it("does not go below the start of the line", () => {
      cursor.expect(0, 5);

      cursor.textChanged("hello", "hell");

      expect(cursor.resolve(4)).toBe(0);
    });

    it.each([
      ["text removed behind the cursor", "hello world", "hello"],
      ["text changed elsewhere", "hello", "jello"],
      ["text inserted elsewhere", "hello", "xhello"],
      ["another line", "hello", "git status"],
    ])("ends with %s", (_name, previousText, text) => {
      cursor.textChanged(previousText, text);

      expect(cursor.resolve(9)).toBe(9);
    });

    it("does not live longer for it", () => {
      vi.advanceTimersByTime(EXPECTED_CURSOR_TTL_MS - 1);
      cursor.textChanged("hello", "hellox");
      vi.advanceTimersByTime(1);

      expect(cursor.resolve(6)).toBe(6);
    });
  });

  it("ignores a text change while nothing is expected", () => {
    cursor.textChanged("hello", "hellox");

    expect(cursor.resolve(6)).toBe(6);
  });
});
