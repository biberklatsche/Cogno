export interface SideMenuFeatureHandleContract<TIcon = string> {
  registerKeybindListener(keys: string[], handler: (keyboardEvent: KeyboardEvent) => void): void;
  unregisterKeybindListener(): void;
  close(): void;
  updateIcon(icon: TIcon): void;
}


