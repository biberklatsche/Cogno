import { describe, expect, it } from "vitest";
import { createConfigSchema } from "./config-schema";

const profile = {
  shell_type: "ZSH",
  path: "/bin/zsh",
  inject_cogno_cli: true,
  enable_shell_integration: true,
  load_user_rc: true,
};

describe("createConfigSchema", () => {
  it("accepts a shell profile on a host that remote.hosts defines", () => {
    const result = createConfigSchema().safeParse({
      remote: { hosts: { mac: { destination: "lars@macbook" } } },
      shell: {
        default: "local",
        profiles: { local: profile, "mac-zsh": { ...profile, host: "mac" } },
      },
    });

    expect(result.success).toBe(true);
  });

  it("names the profile whose host is not defined", () => {
    const result = createConfigSchema().safeParse({
      shell: { default: "mac-zsh", profiles: { "mac-zsh": { ...profile, host: "mac" } } },
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual([
      expect.objectContaining({
        path: ["shell", "profiles", "mac-zsh", "host"],
        message: "Host 'mac' of shell profile 'mac-zsh' is not defined in remote.hosts.",
      }),
    ]);
  });

  it("requires a destination for a host", () => {
    const result = createConfigSchema().safeParse({ remote: { hosts: { mac: {} } } });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["remote", "hosts", "mac", "destination"]);
  });
});
