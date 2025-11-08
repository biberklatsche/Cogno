// Shared types and interfaces for components used within the menu overlay

import {ActionName} from "../../config/+models/config.types";

// Local name union used by the color picker item
export type ColorName = 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan';

export interface MenuOverlayComponent {
  // Provided by MenuOverlayService upon open; call to close the overlay
  close?: () => void;
}

export type ContextMenuItem = {
  // Regular action item
  label?: string;
  actionName?: ActionName;
  action?: (arg?: any) => void;
  disabled?: boolean;
  separator?: boolean;

  // Fixed color picker embedding
  colorpicker?: boolean;
  selectedColorName?: ColorName;
};

export interface ContextMenuOverlayComponent extends MenuOverlayComponent {
  items: ContextMenuItem[];
}
