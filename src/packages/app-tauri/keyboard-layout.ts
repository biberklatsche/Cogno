import {invoke} from "@tauri-apps/api/core";

export type WindowsKeyboardLayoutInfo = {
    id: string,   // KLID wie "00000407"
    name: string, // Userfreundlicher Name (hier KLID als Fallback)
};

export type LinuxKeyboardLayoutInfo = {
    model: string,
    layout: string,
    variant: string,
    options: string,
    rules: string,
};

export type MacKeyboardLayoutInfo = {
    id: string,
    localized_name: string,
    lang: string,
}

export const KeyboardLayout = {
    load(): Promise<WindowsKeyboardLayoutInfo | LinuxKeyboardLayoutInfo | MacKeyboardLayoutInfo> {
        return invoke<WindowsKeyboardLayoutInfo | LinuxKeyboardLayoutInfo | MacKeyboardLayoutInfo>("get_keyboard_layout");
    },
}

