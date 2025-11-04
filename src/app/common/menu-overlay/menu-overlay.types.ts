// Shared types and interfaces for components used within the menu overlay

import {ActionName} from "../../config/+models/config";

export interface MenuOverlayComponent {
  // Provided by MenuOverlayService upon open; call to close the overlay
  close?: () => void;
}

export type ContextMenuItem = {
  label?: string;
  actionName?: ActionName;
  action?: () => void;
  disabled?: boolean;
  separator?: boolean;
};

export interface ContextMenuOverlayComponent extends MenuOverlayComponent {
  items: ContextMenuItem[];
}
