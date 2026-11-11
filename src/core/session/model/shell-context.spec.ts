import { describe, expect, it } from "vitest";
import { contextFromHandshake, deriveShellContext } from "./shell-context";

describe("deriveShellContext", () => {
  it("returns base context on non-windows", () => {
    const ctx = deriveShellContext(
      "Bash",
      { shell_type: "Bash", path: "/bin/bash" } as any,
      "macos",
    );
    expect(ctx).toEqual({ shellType: "Bash", backendOs: "macos" });
  });

  it("returns WSL context when shell path is wsl and distro in args", () => {
    const ctx = deriveShellContext(
      "Bash",
      {
        shell_type: "Bash",
        path: "C:\\Windows\\System32\\wsl.exe",
        args: ["-d", "Ubuntu-24.04"],
      } as any,
      "windows",
    );

    expect(ctx).toEqual({ shellType: "Bash", backendOs: "windows", wslDistroName: "Ubuntu-24.04" });
  });

  it("returns WSL context when distro is set in env", () => {
    const ctx = deriveShellContext(
      "ZSH",
      {
        shell_type: "ZSH",
        path: "wsl.exe",
        env: { WSL_DISTRO_NAME: "Debian" },
      } as any,
      "windows",
    );

    expect(ctx).toEqual({ shellType: "ZSH", backendOs: "windows", wslDistroName: "Debian" });
  });

  it("does not force WSL context when distro is unknown", () => {
    const ctx = deriveShellContext(
      "Bash",
      {
        shell_type: "Bash",
        path: "wsl.exe",
        args: [],
      } as any,
      "windows",
    );

    expect(ctx).toEqual({ shellType: "Bash", backendOs: "windows" });
  });

  it("names the machine of a shell that runs on another one", () => {
    const ctx = deriveShellContext(
      "ZSH",
      { shell_type: "ZSH", path: "/bin/zsh" } as any,
      "macos",
      "mac",
    );
    expect(ctx).toEqual({ shellType: "ZSH", backendOs: "macos", host: "mac" });
  });

  it("keeps the WSL distro of a shell on another Windows machine", () => {
    const ctx = deriveShellContext(
      "Bash",
      { shell_type: "Bash", path: "wsl.exe", args: ["-d", "Ubuntu"] } as any,
      "windows",
      "tower",
    );
    expect(ctx).toEqual({
      shellType: "Bash",
      backendOs: "windows",
      wslDistroName: "Ubuntu",
      host: "tower",
    });
  });
});

describe("contextFromHandshake", () => {
  it("leaves a shell started inside another one on the same machine", () => {
    const outer = { shellType: "ZSH", backendOs: "macos", host: "mac" } as const;

    expect(contextFromHandshake({ shell: "bash", os: "macos" }, outer)).toEqual({
      shellType: "Bash",
      backendOs: "macos",
      host: "mac",
    });
  });

  it("adds no machine to a shell of this one", () => {
    const outer = { shellType: "ZSH", backendOs: "macos" } as const;

    expect(contextFromHandshake({ shell: "bash", os: "macos" }, outer)).toEqual({
      shellType: "Bash",
      backendOs: "macos",
    });
  });
});
