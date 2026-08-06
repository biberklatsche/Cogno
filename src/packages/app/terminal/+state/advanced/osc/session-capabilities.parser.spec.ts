import { describe, expect, it } from "vitest";
import { toSessionCapabilities } from "./session-capabilities.parser";

describe("toSessionCapabilities", () => {
  it("maps a full handshake payload", () => {
    const caps = toSessionCapabilities({
      shell: "pwsh",
      shellVersion: "7.4.1",
      nativeActions: "clearLine,deletePreviousWord,replaceCurrentInput",
      bracketedPaste: "false",
    });

    expect(caps).toEqual({
      shellVersion: "7.4.1",
      nativeActions: ["clearLine", "deletePreviousWord", "replaceCurrentInput"],
      bracketedPaste: false,
      degradedReason: undefined,
    });
  });

  it("drops unknown native actions from newer integration scripts", () => {
    const caps = toSessionCapabilities({
      nativeActions: "replaceCurrentInput,teleportCursor",
      bracketedPaste: "true",
    });

    expect(caps.nativeActions).toEqual(["replaceCurrentInput"]);
    expect(caps.bracketedPaste).toBe(true);
  });

  it("treats an empty nativeActions value as no native support", () => {
    const caps = toSessionCapabilities({ nativeActions: "", bracketedPaste: "true" });

    expect(caps.nativeActions).toEqual([]);
  });

  it("keeps the degraded reason for out-of-policy shells", () => {
    const caps = toSessionCapabilities({
      shellVersion: "3.2",
      nativeActions: "",
      bracketedPaste: "false",
      degraded: "bash-version",
    });

    expect(caps.degradedReason).toBe("bash-version");
    expect(caps.nativeActions).toEqual([]);
  });

  it("defaults missing fields conservatively", () => {
    const caps = toSessionCapabilities({});

    expect(caps).toEqual({
      shellVersion: undefined,
      nativeActions: [],
      bracketedPaste: false,
      degradedReason: undefined,
    });
  });
});
