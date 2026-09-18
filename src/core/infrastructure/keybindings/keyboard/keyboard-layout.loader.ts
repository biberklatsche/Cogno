import { Injectable } from "@angular/core";
import { KeyboardLayout } from "@cogno/platform/keyboard-layout";
import { OsPlatform, OsType } from "@cogno/platform/os";
import { KeymapInfo } from "./keyboard-layouts/_.contribution";

/** The keymaps of one OS; imported on demand so only that OS's set is loaded. */
const keymapsByPlatform: Record<OsType, () => Promise<readonly KeymapInfo[]>> = {
  windows: async () =>
    (await import("./keyboard-layouts/layout.contribution.win")).KeyboardLayoutContribution.INSTANCE
      .layoutInfos,
  macos: async () =>
    (await import("./keyboard-layouts/layout.contribution.darwin")).KeyboardLayoutContribution
      .INSTANCE.layoutInfos,
  linux: async () =>
    (await import("./keyboard-layouts/layout.contribution.linux")).KeyboardLayoutContribution
      .INSTANCE.layoutInfos,
};

@Injectable({
  providedIn: "root",
})
export class KeyboardMappingService {
  constructor(private readonly os: OsPlatform) {}

  /**
   * The keymap of the active keyboard layout, or the default one when the
   * layout is unknown or could not be read - keybindings must work either way.
   */
  async loadLayout(): Promise<{ keymapInfo: KeymapInfo }> {
    const [keymaps, layoutId] = await Promise.all([
      keymapsByPlatform[this.os.platform()](),
      KeyboardLayout.load().catch(() => null),
    ]);
    const keymapInfo =
      this.findKeymap(keymaps, layoutId) ??
      // A variant without a keymap of its own ("de(nodeadkeys)") is still closer
      // to its layout ("de") than to the default.
      this.findKeymap(keymaps, layoutId?.replace(/\(.*\)$/, "")) ??
      this.getDefaultKeymapInfo(keymaps);
    return { keymapInfo };
  }

  private findKeymap(
    keymaps: readonly KeymapInfo[],
    layoutId: string | null | undefined,
  ): KeymapInfo | undefined {
    if (!layoutId) {
      return undefined;
    }
    return keymaps.find((keymap) => keymap.layouts.some((layout) => layout.id === layoutId));
  }

  private getDefaultKeymapInfo(keymapInfos: readonly KeymapInfo[]): KeymapInfo {
    const defaultKeymapInfo = keymapInfos.find((keymapInfo) => keymapInfo.isDefault);
    if (!defaultKeymapInfo) {
      throw new Error("No default keyboard layout configured.");
    }
    return defaultKeymapInfo;
  }
}
