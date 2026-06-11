export interface ContextMenuItem {
  label?: string;
  action?: (item?: ContextMenuItem) => void;
  disabled?: boolean;
  closeOnSelect?: boolean;
  separator?: boolean;
  header?: boolean;

  // Toggle item
  toggle?: boolean;
  toggled?: boolean;

  // Precomputed display string for a keybinding (e.g. "⌘ K")
  keybinding?: string;

  // Generic projection slot for app-specific embedded content (e.g. a color picker)
  custom?: boolean;
  customData?: unknown;
}

export interface ContextMenuOverlayComponent {
  // Provided by ContextMenuOverlayService upon open; call to close the overlay
  close?: () => void;
  items: ContextMenuItem[];
}
