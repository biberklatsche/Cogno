export interface SideMenuFeatureHandleContract {
  /**
   * Bind keys while the panel has focus; the host drops them on blur. Escape
   * dismisses the panel by default, binding it here replaces that.
   */
  registerKeybindListener(keys: string[], handler: (keyboardEvent: KeyboardEvent) => void): void;
  /** Done with the panel for now; the host decides whether it closes or only gives the keyboard back. */
  dismiss(): void;
  /** Colour the dot on the menu entry, or clear it with `undefined`. */
  updateBadgeColor(color?: string): void;
}
