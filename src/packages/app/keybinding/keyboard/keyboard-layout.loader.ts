import {Injectable} from "@angular/core";
import {
    KeyboardLayout,
    LinuxKeyboardLayoutInfo,
    MacKeyboardLayoutInfo,
    WindowsKeyboardLayoutInfo
} from "@cogno/app-tauri/keyboard-layout";
import {OS} from "@cogno/app-tauri/os";
import {KeymapInfo} from "./keyboard-layouts/_.contribution";

@Injectable({
    providedIn: 'root'
})
export class KeyboardMappingService {

    constructor() {
    }

    async loadLayout(): Promise<{keymapInfo: KeymapInfo, isFallback: boolean}> {
        const layoutFromOS = await KeyboardLayout.load();
        let keymapInfo: KeymapInfo| undefined;
        switch (OS.platform()) {
            case "windows":
                const winKeyboardMappings = (await import('./keyboard-layouts/layout.contribution.win')).KeyboardLayoutContribution.INSTANCE.layoutInfos;
                const currentWinLayout = layoutFromOS as WindowsKeyboardLayoutInfo;
                keymapInfo = winKeyboardMappings.find(s => (s.layouts).some(i => i.id === currentWinLayout.name));
                if(keymapInfo) {
                    return {keymapInfo: keymapInfo, isFallback: false}
                } else {
                    return {keymapInfo: winKeyboardMappings.find(s => s.isDefault)!, isFallback: true}
                }
            case "macos":
                const darwinKeyboardMappings = (await import('./keyboard-layouts/layout.contribution.darwin')).KeyboardLayoutContribution.INSTANCE.layoutInfos;
                const osDarwinLayout = layoutFromOS as MacKeyboardLayoutInfo;
                keymapInfo = darwinKeyboardMappings.find(s => (s.layouts).some(i => i.id === osDarwinLayout.id));
                if(keymapInfo) {
                    return {keymapInfo: keymapInfo, isFallback: false}
                } else {
                    return {keymapInfo:  darwinKeyboardMappings.find(s => s.isDefault)!, isFallback: true}
                }
            case "linux":
                const linuxKeyboardMappings = (await import('./keyboard-layouts/layout.contribution.linux')).KeyboardLayoutContribution.INSTANCE.layoutInfos;
                const currentLinuxLayout = layoutFromOS as LinuxKeyboardLayoutInfo;
                keymapInfo = linuxKeyboardMappings.find(s => (s.layouts).some(i => i.id === currentLinuxLayout.layout));
                if(keymapInfo) {
                    return {keymapInfo: keymapInfo, isFallback: false}
                } else {
                    return {keymapInfo:  linuxKeyboardMappings.find(s => s.isDefault)!, isFallback: true}
                }
        }
    }
}


