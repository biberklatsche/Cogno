
// Local name union used by the color picker item
import {ActionName} from "../../action/action.models";
import {ColorName} from "../../common/color/color";

export interface ContextMenuOverlayComponent {
  // Provided by ContextMenuOverlayService upon open; call to close the overlay
  close?: () => void;
  items: ContextMenuItem[];
}

export type ContextMenuItem = {
  // Regular action item
  label?: string;
  actionName?: ActionName;
  action?: (arg?: any) => void;
  disabled?: boolean;
  closeOnSelect?: boolean;
  separator?: boolean;
  header?: boolean;

  // Fixed color picker embedding
  colorpicker?: boolean;
  selectedColorName?: ColorName;

  // Toggle item
  toggle?: boolean;
  toggled?: boolean;
};


