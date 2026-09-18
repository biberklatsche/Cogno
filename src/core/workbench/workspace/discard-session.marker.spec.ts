import { afterEach, describe, expect, it, vi } from "vitest";
import { DiscardSessionMarker } from "./discard-session.marker";

describe("DiscardSessionMarker", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("is shared through the browser store, so every window sees it", () => {
    const inOneWindow = new DiscardSessionMarker();
    const inAnotherWindow = new DiscardSessionMarker();
    expect(inAnotherWindow.isSet).toBe(false);

    inOneWindow.set();
    expect(inAnotherWindow.isSet).toBe(true);

    inAnotherWindow.clear();
    expect(inOneWindow.isSet).toBe(false);
  });

  it("reads as not set when the store cannot be accessed", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });

    expect(new DiscardSessionMarker().isSet).toBe(false);
  });
});
