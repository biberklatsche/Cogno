import { describe, expect, it } from "vitest";
import type { CommandPattern } from "../../../history/command-pattern.models";
import type { QueryContext } from "../../autocomplete.types";
import { SuggestionPatternReducer } from "./suggestion-pattern.reducer";

const basePattern: CommandPattern = {
  signature: { key: "", parts: [] },
  totalCount: 5,
  stableTokenCount: 2,
  nonOptionStableTokenCount: 2,
  variableSlotCount: 1,
  lastSeenAt: Date.now(),
  selectedCount: 1,
  slotStatistics: [],
};

function makeSlot(
  totalCount: number,
  distinctValueCount: number,
  topValueCount: number,
  topValue = "value",
) {
  return { slotIndex: 0, totalCount, distinctValueCount, topValue, topValueCount };
}

function makePattern(stableTokens: string[], slots: ReturnType<typeof makeSlot>[]): CommandPattern {
  const parts = [
    ...stableTokens.map((v) => ({ kind: "stable" as const, value: v })),
    ...slots.map((_, i) => ({ kind: "slot" as const, slotIndex: i })),
  ];
  const key = parts
    .map((p) => (p.kind === "stable" ? `stable:${p.value}` : `slot:${p.slotIndex}`))
    .join("|");
  return {
    ...basePattern,
    signature: { key, parts },
    stableTokenCount: stableTokens.length,
    nonOptionStableTokenCount: stableTokens.filter((v) => !v.startsWith("-")).length,
    variableSlotCount: slots.length,
    slotStatistics: slots,
  };
}

const commandContext: QueryContext = {
  mode: "command",
  beforeCursor: "codex",
  inputText: "codex",
  cursorIndex: 5,
  replaceStart: 0,
  replaceEnd: 5,
  cwd: "/home/user",
  shellContext: { shellType: "Bash", backendOs: "macos" },
  query: "codex",
};

describe("SuggestionPatternReducer", () => {
  const reducer = new SuggestionPatternReducer();

  it("surfaces a confirmed pattern with 2 stable tokens", () => {
    const pattern = makePattern(["codex", "resume"], [makeSlot(5, 3, 2)]);
    const result = reducer.reduce([pattern], commandContext);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("codex resume {arg1}");
  });

  it("rejects an unconfirmed pattern (selectedCount: 0)", () => {
    const pattern = { ...makePattern(["codex", "resume"], [makeSlot(5, 3, 2)]), selectedCount: 0 };
    const result = reducer.reduce([pattern], commandContext);
    expect(result).toHaveLength(0);
  });

  it("rejects a pattern with only 1 stable token — single-arg commands are handled by the live collapser instead", () => {
    const sshContext: QueryContext = {
      ...commandContext,
      beforeCursor: "ssh",
      inputText: "ssh",
      replaceEnd: 3,
      query: "ssh",
    };
    const pattern: CommandPattern = {
      ...makePattern(["ssh"], [makeSlot(4, 3, 2)]),
      stableTokenCount: 1,
      nonOptionStableTokenCount: 1,
    };
    const result = reducer.reduce([pattern], sshContext);
    expect(result).toHaveLength(0);
  });

  it("rejects a pattern where all slots are 100% dominated (all-stable pattern)", () => {
    // 10/10 = 1.0 > 0.95 effectivelyStableSlotThreshold → folded, no variable slot left
    const pattern = makePattern(["git", "push"], [makeSlot(10, 1, 10, "origin")]);
    const result = reducer.reduce([pattern], {
      ...commandContext,
      query: "git",
      beforeCursor: "git",
      inputText: "git",
    });
    expect(result).toHaveLength(0);
  });

  it("folds a slot dominated at >95% into the label and renumbers remaining slots", () => {
    const gitContext: QueryContext = {
      ...commandContext,
      beforeCursor: "git push",
      inputText: "git push",
      query: "git",
      replaceEnd: 8,
    };
    const pattern: CommandPattern = {
      ...basePattern,
      signature: {
        key: "stable:git|stable:push|slot:0|slot:1",
        parts: [
          { kind: "stable", value: "git" },
          { kind: "stable", value: "push" },
          { kind: "slot", slotIndex: 0 },
          { kind: "slot", slotIndex: 1 },
        ],
      },
      stableTokenCount: 2,
      nonOptionStableTokenCount: 2,
      variableSlotCount: 2,
      slotStatistics: [
        // 20/20 = 100% → effectively stable (> 0.95 threshold) → folded to "origin"
        {
          slotIndex: 0,
          totalCount: 20,
          distinctValueCount: 1,
          topValue: "origin",
          topValueCount: 20,
        },
        { slotIndex: 1, totalCount: 10, distinctValueCount: 5, topValue: "main", topValueCount: 3 },
      ],
    };

    const result = reducer.reduce([pattern], gitContext);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("git push origin {arg1}");
  });

  it("surfaces a pattern even when one slot is effectively stable (folded), as long as another has real variance", () => {
    const gitContext: QueryContext = {
      ...commandContext,
      beforeCursor: "git push",
      inputText: "git push",
      query: "git",
      replaceEnd: 8,
    };
    const pattern: CommandPattern = {
      ...basePattern,
      signature: {
        key: "stable:git|stable:push|slot:0|slot:1",
        parts: [
          { kind: "stable", value: "git" },
          { kind: "stable", value: "push" },
          { kind: "slot", slotIndex: 0 },
          { kind: "slot", slotIndex: 1 },
        ],
      },
      stableTokenCount: 2,
      nonOptionStableTokenCount: 2,
      variableSlotCount: 2,
      slotStatistics: [
        // 20/20 = 100% → effectively stable → folded to "origin"
        {
          slotIndex: 0,
          totalCount: 20,
          distinctValueCount: 1,
          topValue: "origin",
          topValueCount: 20,
        },
        { slotIndex: 1, totalCount: 10, distinctValueCount: 5, topValue: "main", topValueCount: 3 },
      ],
    };

    const result = reducer.reduce([pattern], gitContext);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("git push origin {arg1}");
  });

  it("survives without variance ratio gate: 5x id1, 1x id2 is still a valid pattern", () => {
    // variance ratio = 2/6 ≈ 0.33 — would have failed old minimumSlotVarianceRatio: 0.45
    const pattern = makePattern(
      ["codex", "resume"],
      [{ slotIndex: 0, totalCount: 6, distinctValueCount: 2, topValue: "id1", topValueCount: 5 }],
    );
    const result = reducer.reduce([pattern], commandContext);
    expect(result).toHaveLength(1);
  });
});
