export interface DialogConfig<TData = unknown> {
  title?: string;
  data?: TData;

  // Behavior
  hasBackdrop?: boolean; // default true
  closeOnBackdropClick?: boolean; // default true
  closeOnEscape?: boolean; // default true
  showCloseButton?: boolean; // default false

  // Sizing
  width?: string;
  maxWidth?: string;
}
