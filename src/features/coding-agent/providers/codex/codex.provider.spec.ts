import { describe, expect, it } from "vitest";
import { patchedFiles } from "./codex.provider";

describe("patchedFiles", () => {
  it("reads every file an apply_patch adds, updates, deletes or moves to", () => {
    const patch = [
      "*** Begin Patch",
      "*** Add File: src/new.ts",
      "+export {};",
      "*** Update File: src/old.ts",
      "*** Move to: src/renamed.ts",
      "@@",
      "-a",
      "+b",
      "*** Delete File: src/gone.ts",
      "*** End Patch",
    ].join("\r\n");
    expect(patchedFiles({ tool_name: "apply_patch", tool_input: { command: patch } })).toEqual([
      "src/new.ts",
      "src/old.ts",
      "src/renamed.ts",
      "src/gone.ts",
    ]);
  });

  it("ignores other tools", () => {
    expect(
      patchedFiles({ tool_name: "Bash", tool_input: { command: "*** Add File: x.ts" } }),
    ).toEqual([]);
  });
});
