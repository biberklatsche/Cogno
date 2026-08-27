import { OsPlatform, OsType } from "@cogno/platform/os";
import { describe, expect, it } from "vitest";
import { KeybindingPipe } from "./keybinding.pipe";

const pipeFor = (platform: OsType) =>
  new KeybindingPipe({ platform: () => platform } as OsPlatform);

describe("KeybindingPipe", () => {
  const pipe = pipeFor("linux");

  it("null", () => {
    expect(pipe.transform(null)).toBe("");
  });

  it("undefined", () => {
    expect(pipe.transform(undefined)).toBe("");
  });

  it("macos command", () => {
    expect(pipeFor("macos").transform("Command + A")).toBe("⌘ A");
  });

  it("macos control", () => {
    expect(pipeFor("macos").transform("Control + A")).toBe("⌃ A");
  });

  it("macos option", () => {
    expect(pipeFor("macos").transform("Alt + A")).toBe("⌥ A");
  });

  it("macos order", () => {
    expect(pipeFor("macos").transform("Command + Shift + Alt + Control + A")).toBe("⌃ ⌥ ⇧ ⌘ A");
  });

  it("other", () => {
    expect(pipeFor("windows").transform("Control + A")).toBe("Ctrl+A");
  });
});
