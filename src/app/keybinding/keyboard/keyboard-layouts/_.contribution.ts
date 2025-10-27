import {KeyboardLayoutInfo} from './keyboard.models';

export type KeyCode = string;
export type KeyName = string;
export type KeyboardMapping = Record<KeyCode, KeyName>;

export type KeymapInfo = {
    layouts: KeyboardLayoutInfo[],
    mapping: KeyboardMapping,
    isDefault?: boolean,
}

export class KeyboardLayoutContribution {
    public static readonly INSTANCE: KeyboardLayoutContribution = new KeyboardLayoutContribution();

    private _layoutInfos: KeymapInfo[] = [];

    get layoutInfos(): KeymapInfo[] {
        return this._layoutInfos;
    }

    private constructor() {
    }

    registerKeyboardLayout(layout: KeymapInfo) {
        this._layoutInfos.push(layout);
    }
}
