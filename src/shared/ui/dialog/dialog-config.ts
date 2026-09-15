import { TemplateRef, Type } from "@angular/core";

export interface DialogConfig<TData = unknown, TContext = unknown> {
  // Content
  content?: Type<unknown> | TemplateRef<TContext>;
  title?: string;
  data?: TData;

  // Behavior
  hasBackdrop?: boolean; // default true
  movable?: boolean; // default false
  resizable?: boolean; // default false
  closeOnBackdropClick?: boolean; // default true
  closeOnEscape?: boolean; // default true
  position?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };

  // Sizing / classes
  width?: string;
  height?: string;
  maxWidth?: string;
  maxHeight?: string;
  panelClass?: string | string[];
  backdropClass?: string | string[];
  showCloseButton?: boolean; // default false
}
