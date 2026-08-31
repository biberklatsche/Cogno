import type { WorkbenchAction } from "@cogno/core/workbench/workbench-actions";
import { describe, expect, it } from "vitest";
import type { SessionFact } from "./session-facts";

// A session states facts; it never tells the workbench what to do. If a
// name ever appears in both unions, this stops compiling.
type Overlap = Extract<SessionFact["type"], WorkbenchAction["type"]>;
const disjoint: [Overlap] extends [never] ? true : false = true;

describe("SessionFact", () => {
  it("shares no type with WorkbenchAction", () => {
    expect(disjoint).toBe(true);
  });
});
