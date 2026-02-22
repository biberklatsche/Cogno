import { describe, expect, it } from "vitest";
import { deriveShellContext } from "./terminal-shell-context.util";

describe("deriveShellContext", () => {
    it("returns base context on non-windows", () => {
        const ctx = deriveShellContext("Bash", { shell_type: "Bash", path: "/bin/bash" } as any, "macos");
        expect(ctx).toEqual({ shellType: "Bash", backendOs: "macos" });
    });

    it("returns WSL context when shell path is wsl and distro in args", () => {
        const ctx = deriveShellContext("Bash", {
            shell_type: "Bash",
            path: "C:\\Windows\\System32\\wsl.exe",
            args: ["-d", "Ubuntu-24.04"],
        } as any, "windows");

        expect(ctx).toEqual({ shellType: "Bash", backendOs: "windows", wslDistroName: "Ubuntu-24.04" });
    });

    it("returns WSL context when distro is set in env", () => {
        const ctx = deriveShellContext("Fish", {
            shell_type: "Fish",
            path: "wsl.exe",
            env: { WSL_DISTRO_NAME: "Debian" },
        } as any, "windows");

        expect(ctx).toEqual({ shellType: "Fish", backendOs: "windows", wslDistroName: "Debian" });
    });

    it("does not force WSL context when distro is unknown", () => {
        const ctx = deriveShellContext("Bash", {
            shell_type: "Bash",
            path: "wsl.exe",
            args: [],
        } as any, "windows");

        expect(ctx).toEqual({ shellType: "Bash", backendOs: "windows" });
    });
});

