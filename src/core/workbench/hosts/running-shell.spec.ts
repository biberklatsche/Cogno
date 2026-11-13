import { ShellProfile } from "@cogno/core/infrastructure/config/models/shell-config";
import { describe, expect, it } from "vitest";
import { TauriMockFactory } from "../../../__test__/mocks/tauri-mock.factory";
import { runningShell } from "./running-shell";

const configured = {
  shell_type: "PowerShell",
  path: "pwsh",
  enable_shell_integration: false,
} as unknown as ShellProfile;

describe("runningShell", () => {
  it("takes what kind of shell it is and its secret from the shell itself", () => {
    const shell = runningShell(configured, TauriMockFactory.createSessionInfo());

    expect(shell.profile.shell_type).toBe("Bash");
    expect(shell.profile.enable_shell_integration).toBe(true);
    expect(shell.profile.path).toBe("pwsh");
    expect(shell.sessionToken).toBe("running-token");
  });

  it("trusts no integration of a shell whose host kept no secret for it", () => {
    const running = TauriMockFactory.createSessionInfo();
    const withoutSecret = { ...running, profile: { ...running.profile, env: {} } };

    const shell = runningShell(configured, withoutSecret);

    expect(shell.profile.enable_shell_integration).toBe(false);
    expect(shell.sessionToken).toBeUndefined();
  });
});
