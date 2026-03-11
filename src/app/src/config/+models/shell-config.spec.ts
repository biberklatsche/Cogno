import { describe, expect, it } from "vitest";
import { ShellConfigSchema } from "./shell-config";

describe("ShellConfigSchema", () => {
  it("rejects more than 9 shell profiles", () => {
    const profiles = Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => [
        `shell${index + 1}`,
        {
          shell_type: "PowerShell",
          inject_cogno_cli: true,
          enable_shell_integration: true,
          load_user_rc: true,
        },
      ]),
    );

    const result = ShellConfigSchema.safeParse({
      default: "shell1",
      profiles,
    });

    expect(result.success).toBe(false);
    expect(result.error.issues.some(issue => issue.message === "At most 9 shell profiles may be defined.")).toBe(true);
  });
});
