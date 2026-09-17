import { describe, expect, it } from "vitest";
import { actionLabel, coreActionCatalog } from "./catalog";

describe("actionLabel", () => {
  it("is the catalog label of a core action", () => {
    expect(actionLabel("open_config")).toBe("Settings");
    expect(actionLabel("split_right")).toBe("Split Right");
  });

  it("covers the numbered actions generated from the slot list", () => {
    expect(actionLabel("open_shell_3")).toBe("Open Shell 3");
    expect(actionLabel("select_workspace_9")).toBe("Select Workspace 9");
  });

  it("falls back to the name in words for an action without a label (feature actions)", () => {
    expect(actionLabel("open_git")).toBe("open git");
  });

  it("finds a label for every core action", () => {
    for (const entry of coreActionCatalog) {
      expect(actionLabel(entry.name)).toBe(entry.label);
    }
  });
});
