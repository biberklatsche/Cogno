import {AppBus} from "../app/app-bus/app-bus";
import {SideMenuService} from "../app/menu/side-menu/+state/side-menu.service";
import {ConfigServiceMock} from "./mocks/config-service.mock";
import {DestroyRef} from "@angular/core";
import {KeybindService} from "../app/keybinding/keybind.service";
import {KeyboardMappingService} from "../app/keybinding/keyboard/keyboard-layout.loader";

let appBus: AppBus | undefined;
let sideMenuService: SideMenuService | undefined;
let configService: ConfigServiceMock | undefined;
let keybindService: KeybindService | undefined;
let keybindMappingService: KeyboardMappingService | undefined;

export function getAppBus(): AppBus {
    if(!appBus) appBus = new AppBus();
    return appBus;
}

export function getSideMenuService(): SideMenuService {
    if(!sideMenuService) sideMenuService = new SideMenuService(getAppBus());
    return sideMenuService;
}

export function getConfigService(): ConfigServiceMock {
    if(!configService) configService = new ConfigServiceMock();
    return configService;
}

export function getKeybindService(): KeybindService {
    if(!keybindService) keybindService = new KeybindService(
        getKeyboardMappingService(),
        getConfigService(),
        getAppBus(),
        getDestroyRef()
    );
    return keybindService;
}

export function getKeyboardMappingService(): KeyboardMappingService {
    if(!keybindMappingService) keybindMappingService = new KeyboardMappingService();
    return keybindMappingService;
}

export function getDestroyRef(): DestroyRef {
    return {
        onDestroy: function (callback: () => void): () => void {
            return () => {}
        },
        destroyed: false
    };
}


export function clear() {
    appBus = undefined;
    sideMenuService = undefined;
    configService = undefined;
}
