import { SignInStatus, SignIns } from "@cogno/platform";
import { describe, expect, it, vi } from "vitest";
import { GitSignIns } from "./git-sign-ins.service";

const provider = {
  authorizeUrl: "https://gitlab.com/oauth/authorize",
  tokenUrl: "https://gitlab.com/oauth/token",
  clientId: "client",
  scopes: ["write_repository"],
  username: "oauth2",
};
const gitlab: SignInStatus = { origin: "https://gitlab.com", persistent: true };

function setup(listed: ReadonlyArray<SignInStatus> = []) {
  let changed: (statuses: ReadonlyArray<SignInStatus>) => void = () => undefined;
  const platform = {
    list: vi.fn().mockResolvedValue(listed),
    onChanged: vi.fn((listener) => {
      changed = listener;
      return Promise.resolve(() => undefined);
    }),
    signIn: vi.fn(),
    cancel: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(true),
  };
  const service = new GitSignIns(platform as unknown as SignIns, { onDestroy: vi.fn() } as never);
  return {
    service,
    platform,
    changed: (statuses: ReadonlyArray<SignInStatus>) => changed(statuses),
  };
}

describe("GitSignIns", () => {
  it("knows who is signed in from the start and follows the backend", async () => {
    const { service, changed } = setup([gitlab]);
    await vi.waitFor(() => expect(service.status("https://gitlab.com")).toEqual(gitlab));

    changed([]);

    expect(service.status("https://gitlab.com")).toBeNull();
  });

  it("hands a failed sign-in back as its reason", async () => {
    const { service, platform } = setup();
    platform.signIn.mockRejectedValue("The sign-in was cancelled.");

    expect(await service.signIn("https://gitlab.com", provider)).toBe("The sign-in was cancelled.");
  });

  it("reports a stored sign-in as no failure", async () => {
    const { service, platform } = setup();
    platform.signIn.mockResolvedValue(gitlab);

    expect(await service.signIn("https://gitlab.com", provider)).toBeNull();
    expect(platform.signIn).toHaveBeenCalledWith("https://gitlab.com", provider);
  });
});
