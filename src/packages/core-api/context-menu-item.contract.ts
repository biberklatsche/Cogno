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

  // CSS color applied to the label (e.g. "var(--color-red)")
  color?: string;

  // Check column on the right. Any defined value (true or false) reserves the
  // column so that labels do not shift between checked and unchecked items.
  checked?: boolean;

  // Generic projection slot for app-specific embedded content (e.g. a color picker)
  custom?: boolean;
  customData?: unknown;
}

export interface ContextMenuOverlayComponent {
  // Provided by ContextMenuOverlayService upon open; call to close the overlay
  close?: () => void;
  items: ContextMenuItem[];
}
