import {AppBus} from "../app-shell/app-bus/app-bus";
import {SideMenuService} from "../app-shell/menu/side-menu/+state/side-menu.service";
import {ConfigServiceMock} from "./mocks/config-service.mock";
import {DestroyRef} from "@angular/core";
import {KeybindService} from "../app-shell/keybinding/keybind.service";
import {KeyboardMappingService} from "../app-shell/keybinding/keyboard/keyboard-layout.loader";
import {vi} from "vitest";
import {GridListService} from "../app-shell/grid-list/+state/grid-list.service";
import {TabListService} from "../app-shell/tab-list/+state/tab-list.service";
import {TerminalComponentFactory} from "../app-shell/grid-list/+state/terminal-component.factory";
import {WindowService} from "../app-shell/window/window.service";
import {FocusHandler} from "../app-shell/terminal/+state/handler/focus.handler";
import {SelectionHandler} from "../app-shell/terminal/+state/handler/selection.handler";
import {TerminalId} from "../app-shell/grid-list/+model/model";
import {TerminalStateManager} from "../app-shell/terminal/+state/state";
import {ShellType} from "../app-shell/config/+models/config";
import {TerminalSession} from "../app-shell/terminal/+state/terminal.session";
import { TerminalAutocompleteFeatureSuggestorService } from "../app-shell/app-host/terminal-autocomplete-feature-suggestor.service";
import { CoreHostWiringService } from "../app-shell/app-host/core-host-wiring.service";

let appBus: AppBus | undefined;
let sideMenuService: SideMenuService | undefined;
let configService: ConfigServiceMock | undefined;
let keybindService: KeybindService | undefined;
let keybindMappingService: KeyboardMappingService | undefined;
let gridListService: GridListService | undefined;
let tabListService: TabListService | undefined;
let terminalComponentFactory: TerminalComponentFactory | undefined;
let windowService: WindowService | undefined;
let focusHandler: FocusHandler | undefined;
let selectionHandler: SelectionHandler | undefined;
let stateManager: TerminalStateManager | undefined;
let terminalSession: TerminalSession | undefined;
let terminalAutocompleteFeatureSuggestorService: TerminalAutocompleteFeatureSuggestorService | undefined;
let coreHostWiringService: CoreHostWiringService | undefined;

export function getAppBus(): AppBus {
    if(!appBus) appBus = new AppBus();
    return appBus;
}

export function getStateManager(): TerminalStateManager {
    if(!stateManager) {
        stateManager = new TerminalStateManager(getAppBus());
        stateManager.initialize('test-terminal', 'Bash' as any);
    }
    return stateManager;
}

export function getSideMenuService(): SideMenuService {
    if(!sideMenuService) sideMenuService = new SideMenuService(getAppBus());
    return sideMenuService;
}

export function getTerminalSession(): TerminalSession {
    if(!terminalSession) {
        terminalSession = new TerminalSession(
            getConfigService(),
            getAppBus(),
            getStateManager(),
            getTerminalAutocompleteFeatureSuggestorService(),
            { open: () => ({ close: () => undefined }) } as any,
            getCoreHostWiringService(),
        );
    }
    return terminalSession;
}

export function getTerminalAutocompleteFeatureSuggestorService(): TerminalAutocompleteFeatureSuggestorService {
    if (!terminalAutocompleteFeatureSuggestorService) {
        terminalAutocompleteFeatureSuggestorService = {
            getSharedSuggestors: vi.fn().mockReturnValue([]),
            preloadForShellIntegration: vi.fn(),
        } as unknown as TerminalAutocompleteFeatureSuggestorService;
    }
    return terminalAutocompleteFeatureSuggestorService;
}

export function getConfigService(): ConfigServiceMock {
    if(!configService) configService = new ConfigServiceMock();
    return configService;
}

export function getCoreHostWiringService(): CoreHostWiringService {
    if (!coreHostWiringService) {
        coreHostWiringService = {
            getShellDefinitions: vi.fn().mockReturnValue([]),
        } as unknown as CoreHostWiringService;
    }
    return coreHostWiringService;
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

export function getGridListService(): GridListService {
    if(!gridListService) {
        gridListService = new GridListService(
            getAppBus(),
            getTerminalComponentFactory(),
            getDestroyRef()
        );
    }
    return gridListService;
}

export function getTabListService(): TabListService {
    if(!tabListService) {
        tabListService = new TabListService(
            getAppBus(),
            getConfigService(),
            getDestroyRef()
        );
    }
    return tabListService;
}

export function getTerminalComponentFactory(): TerminalComponentFactory {
    if(!terminalComponentFactory) {
        terminalComponentFactory = {
            destroy: vi.fn(),
            getSnapshot: vi.fn(),
            attach: vi.fn(),
        } as unknown as TerminalComponentFactory;
    }
    return terminalComponentFactory;
}

export function getDestroyRef(): DestroyRef {
    return {
        onDestroy: function (callback: () => void): () => void {
            return () => {}
        },
        destroyed: false
    };
}

export function getWindowService(): WindowService {
    if(!windowService) {
        windowService = new WindowService(
            getAppBus(),
            getDestroyRef()
        );
    }
    return windowService;
}

export function getFocusHandler(terminalId: TerminalId): FocusHandler {
    if(!focusHandler) {
        focusHandler = new FocusHandler(terminalId, getAppBus(), getStateManager());
    }
    return focusHandler;
}

export function getSelectionHandler(terminalId: TerminalId): SelectionHandler {
    if(!selectionHandler) {
        selectionHandler = new SelectionHandler(getAppBus(), getConfigService(), terminalId, getStateManager());
    }
    return selectionHandler;
}


export function clear() {
    appBus = undefined;
    sideMenuService = undefined;
    configService = undefined;
    keybindService = undefined;
    keybindMappingService = undefined;
    gridListService = undefined;
    tabListService = undefined;
    terminalComponentFactory = undefined;
    windowService = undefined;
    focusHandler = undefined;
    selectionHandler = undefined;
    stateManager = undefined;
    terminalSession = undefined;
    terminalAutocompleteFeatureSuggestorService = undefined;
    coreHostWiringService = undefined;
}
