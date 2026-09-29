import { afterEach, describe, expect, it, vi } from "vitest";
import { IdCreator } from "./id-creator";

describe("IdCreator", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("creates prefixed ids for all entity types", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-07T12:00:00.000Z"));
    vi.spyOn(Math, "random").mockReturnValue(0.123456789);

    expect(IdCreator.newId("ID")).toMatch(/^ID/);
    expect(IdCreator.newTabId()).toMatch(/^TB/);
    expect(IdCreator.newTerminalId()).toMatch(/^TE/);
    expect(IdCreator.newWorkspaceId()).toMatch(/^WS/);
  });
});
