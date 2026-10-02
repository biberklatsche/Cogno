export interface SideMenuFeatureHandleContract<TIcon = string> {
  registerKeybindListener(keys: string[], handler: (keyboardEvent: KeyboardEvent) => void): void;
  unregisterKeybindListener(): void;
  close(): void;
  updateIcon(icon: TIcon): void;
  /** Colour the dot on the menu entry, or clear it with `undefined`. */
  updateBadgeColor(color?: string): void;
}
