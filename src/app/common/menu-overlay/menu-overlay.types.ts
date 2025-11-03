// Shared types and interfaces for components used within the menu overlay

export interface MenuOverlayComponent {
  // Provided by MenuOverlayService upon open; call to close the overlay
  close?: () => void;
}

export type ContextMenuItem = {
  label?: string;
  keybinding?: string;
  action?: () => void;
  disabled?: boolean;
  separator?: boolean;
};

export interface ContextMenuOverlayComponent extends MenuOverlayComponent {
  items: ContextMenuItem[];
}
