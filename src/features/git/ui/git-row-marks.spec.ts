import { describe, expect, it } from "vitest";
import { GitRowMarks } from "./git-row-marks";

const ROWS = ["a", "b", "c", "d"];

function click(modifiers: Partial<MouseEvent> = {}): MouseEvent {
  return { shiftKey: false, metaKey: false, ctrlKey: false, ...modifiers } as MouseEvent;
}

describe("GitRowMarks", () => {
  it("toggles single rows with Cmd or Ctrl", () => {
    const marks = new GitRowMarks();

    expect(marks.click(click({ metaKey: true }), "a", ROWS)).toBe(true);
    marks.click(click({ ctrlKey: true }), "c", ROWS);
    marks.click(click({ metaKey: true }), "a", ROWS);

    expect([...marks.names()]).toEqual(["c"]);
  });

  it("marks the range from the row clicked last with Shift, in either direction", () => {
    const marks = new GitRowMarks();

    marks.click(click(), "d", ROWS);
    marks.click(click({ shiftKey: true }), "b", ROWS);

    expect([...marks.names()].sort()).toEqual(["b", "c", "d"]);
  });

  it("adds a Shift range to the rows already marked", () => {
    const marks = new GitRowMarks();

    marks.click(click({ metaKey: true }), "a", ROWS);
    marks.click(click({ metaKey: true }), "c", ROWS);
    marks.click(click({ shiftKey: true }), "d", ROWS);

    expect([...marks.names()].sort()).toEqual(["a", "c", "d"]);
  });

  it("marks only the clicked row when Shift has no anchor", () => {
    const marks = new GitRowMarks();

    marks.click(click({ shiftKey: true }), "b", ROWS);

    expect([...marks.names()]).toEqual(["b"]);
  });

  it("clears the marks on a plain click and leaves the click to the row", () => {
    const marks = new GitRowMarks();
    marks.click(click({ metaKey: true }), "a", ROWS);

    expect(marks.click(click(), "b", ROWS)).toBe(false);
    expect(marks.names().size).toBe(0);
  });
});
