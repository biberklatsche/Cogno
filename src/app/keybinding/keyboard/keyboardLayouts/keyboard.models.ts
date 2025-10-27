

export type WindowsKeyboardLayoutInfo = {
  name: string;
  id: string;
  text: string;
}

export type LinuxKeyboardLayoutInfo = {
  model: string;
  group: number;
  layout: string;
  variant: string;
  options: string;
  rules: string;
}

export type MacKeyboardLayoutInfo = {
  id: string;
  localizedName: string;
  lang: string;
}

export type KeyboardLayoutInfo = (WindowsKeyboardLayoutInfo | LinuxKeyboardLayoutInfo | MacKeyboardLayoutInfo) & {
  id: string;
  label: string;
};
