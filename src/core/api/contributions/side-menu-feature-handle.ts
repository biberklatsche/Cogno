export interface SideMenuFeatureHandleContract {
  /**
   * Bind keys while the panel has focus; the host drops them on blur. Escape
   * calls `close()` by default, binding it here replaces that.
   */
  registerKeybindListener(keys: string[], handler: (keyboardEvent: KeyboardEvent) => void): void;
  /** Done with the panel for now: a floating one closes, a pinned one gives the keyboard back. */
  close(): void;
  /** Colour the dot on the menu entry, or clear it with `undefined`. */
  updateBadgeColor(color?: string): void;
}
