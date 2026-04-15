import { OS } from "@cogno/app-tauri/os";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KeybindingPipe } from "./keybinding.pipe";

describe("KeybindingPipe", () => {
  let pipe: KeybindingPipe;

  beforeEach(() => {
    pipe = new KeybindingPipe();
  });

  it("null", () => {
    expect(pipe.transform(null)).toBe("");
  });

  it("undefined", () => {
    expect(pipe.transform(undefined)).toBe("");
  });

  it("macos command", () => {
    vi.spyOn(OS, "platform").mockReturnValue("macos");
    expect(pipe.transform("Command + A")).toBe("⌘ A");
  });

  it("macos control", () => {
    vi.spyOn(OS, "platform").mockReturnValue("macos");
    expect(pipe.transform("Control + A")).toBe("⌃ A");
  });

  it("macos option", () => {
    vi.spyOn(OS, "platform").mockReturnValue("macos");
    expect(pipe.transform("Alt + A")).toBe("⌥ A");
  });

  it("macos order", () => {
    vi.spyOn(OS, "platform").mockReturnValue("macos");

    expect(pipe.transform("Command + Shift + Alt + Control + A")).toBe("⌃ ⌥ ⇧ ⌘ A");
  });

  it("other", () => {
    vi.spyOn(OS, "platform").mockReturnValue("windows");
    expect(pipe.transform("Control + A")).toBe("Ctrl+A");
  });
});
