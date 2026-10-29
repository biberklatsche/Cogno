export interface SideMenuFeatureHandleContract<TIcon = string> {
  /**
   * Bind keys while the panel has focus; the host drops them on blur. Escape
   * closes the panel by default, binding it here replaces that.
   */
  registerKeybindListener(keys: string[], handler: (keyboardEvent: KeyboardEvent) => void): void;
  close(): void;
  updateIcon(icon: TIcon): void;
  /** Colour the dot on the menu entry, or clear it with `undefined`. */
  updateBadgeColor(color?: string): void;
}
