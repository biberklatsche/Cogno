import { describe, expect, it } from "vitest";
import { BashPathAdapter } from "./bash/bash.path-adapter";
import { PowerShellPathAdapter } from "./powershell/powershell.path-adapter";
import { createPathAdapter } from "./shell-definitions";
import { ZshPathAdapter } from "./zsh/zsh.path-adapter";

describe("createPathAdapter", () => {
  it("should create BashPathAdapter", () => {
    expect(createPathAdapter({ shellType: "Bash", backendOs: "linux" })).toBeInstanceOf(
      BashPathAdapter,
    );
  });

  it("should create ZshPathAdapter", () => {
    expect(createPathAdapter({ shellType: "ZSH", backendOs: "macos" })).toBeInstanceOf(
      ZshPathAdapter,
    );
  });

  it("should create PowerShellPathAdapter", () => {
    expect(createPathAdapter({ shellType: "PowerShell", backendOs: "windows" })).toBeInstanceOf(
      PowerShellPathAdapter,
    );
  });

  it("should throw error for unsupported shell type", () => {
    expect(() => createPathAdapter({ shellType: "Unsupported" } as never)).toThrow(
      "Unsupported shell type: Unsupported",
    );
  });
});
