import {TemplateRef, Type} from '@angular/core';

export interface DialogConfig<TData = unknown, TContext = unknown> {
  // Content
  content?: Type<unknown> | TemplateRef<TContext>;
  title?: string;
  data?: TData;

  // Behavior
  hasBackdrop?: boolean; // default true

  // Sizing / classes
  width?: string;
  height?: string;
  maxWidth?: string;
  maxHeight?: string;
  panelClass?: string | string[];
  backdropClass?: string | string[];
  showCloseButton?: boolean; // default false
}
