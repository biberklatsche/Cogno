/**
 * What the workbench can be told to do. Phase E fills this in; it exists now
 * so the "facts, not commands" type test in core/session has its other side.
 */
export type WorkbenchAction =
  | { readonly type: "focusTerminal"; readonly terminalId: string }
  | { readonly type: "removePane"; readonly terminalId: string };
