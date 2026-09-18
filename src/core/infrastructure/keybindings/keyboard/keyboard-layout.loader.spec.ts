import { KeyboardLayout } from "@cogno/platform/keyboard-layout";
import { OsPlatform, OsType } from "@cogno/platform/os";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KeyboardMappingService } from "./keyboard-layout.loader";

vi.mock("@cogno/platform/keyboard-layout", () => ({
  KeyboardLayout: { load: vi.fn() },
}));

function serviceOn(platform: OsType): KeyboardMappingService {
  return new KeyboardMappingService({ platform: () => platform } as OsPlatform);
}

describe("KeyboardMappingService", () => {
  beforeEach(() => {
    vi.mocked(KeyboardLayout.load).mockReset();
  });

  it.each([
    ["windows", "00000407"],
    ["macos", "com.apple.keylayout.German"],
    ["linux", "de"],
  ] as const)("finds the keymap of the %s layout id the backend reports", async (platform, id) => {
    vi.mocked(KeyboardLayout.load).mockResolvedValue(id);

    const { keymapInfo } = await serviceOn(platform).loadLayout();

    expect(keymapInfo.layouts.map((layout) => layout.id)).toContain(id);
    expect(keymapInfo.isDefault).toBeFalsy();
  });

  it.each([
    "windows",
    "macos",
    "linux",
  ] as const)("falls back to the default keymap on %s when the layout is unknown", async (platform) => {
    vi.mocked(KeyboardLayout.load).mockResolvedValue("no-such-layout");

    const { keymapInfo } = await serviceOn(platform).loadLayout();

    expect(keymapInfo.isDefault).toBe(true);
  });

  it.each([
    "windows",
    "macos",
    "linux",
  ] as const)("falls back to the default keymap on %s when the backend found no layout", async (platform) => {
    vi.mocked(KeyboardLayout.load).mockResolvedValue(null);

    const { keymapInfo } = await serviceOn(platform).loadLayout();

    expect(keymapInfo.isDefault).toBe(true);
  });

  it.each([
    // The physical QWERTY "S" key types "O" on US Dvorak and "A" on French Dvorak.
    ["us(dvorak)", "O"],
    ["fr(dvorak)", "A"],
  ] as const)("resolves keys by the %s variant, not by its base layout", async (id, keyOnQwertyS) => {
    vi.mocked(KeyboardLayout.load).mockResolvedValue(id);

    const { keymapInfo } = await serviceOn("linux").loadLayout();

    expect(keymapInfo.layouts.map((layout) => layout.id)).toEqual([id]);
    expect(keymapInfo.mapping["KeyS"]).toBe(keyOnQwertyS);
  });

  it("uses the base layout for a variant without a keymap of its own", async () => {
    vi.mocked(KeyboardLayout.load).mockResolvedValue("de(nodeadkeys)");

    const { keymapInfo } = await serviceOn("linux").loadLayout();

    expect(keymapInfo.layouts.map((layout) => layout.id)).toContain("de");
    expect(keymapInfo.isDefault).toBeFalsy();
  });

  it("falls back to the default keymap when asking the backend fails", async () => {
    vi.mocked(KeyboardLayout.load).mockRejectedValue(new Error("ipc down"));

    const { keymapInfo } = await serviceOn("macos").loadLayout();

    expect(keymapInfo.isDefault).toBe(true);
  });
});
