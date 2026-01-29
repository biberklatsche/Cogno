import {AppBus} from "../app/app-bus/app-bus";
import {SideMenuService} from "../app/menu/side-menu/+state/side-menu.service";
import {ConfigServiceMock} from "./mocks/config-service.mock";
import {DestroyRef} from "@angular/core";
import {KeybindService} from "../app/keybinding/keybind.service";
import {KeyboardMappingService} from "../app/keybinding/keyboard/keyboard-layout.loader";
import {WorkspaceRepository} from "../app/workspace/+state/workspace.repository";
import {vi} from "vitest";
import {GridListService} from "../app/grid-list/+state/grid-list.service";
import {TabListService} from "../app/tab-list/+state/tab-list.service";
import {TerminalComponentFactory} from "../app/grid-list/+state/terminal-component.factory";
import {WindowService} from "../app/window/window.service";
import {FocusHandler} from "../app/terminal/+state/handler/focus.handler";
import {SelectionHandler} from "../app/terminal/+state/handler/selection.handler";
import {TerminalId} from "../app/grid-list/+model/model";
import {TerminalStateManager} from "../app/terminal/+state/state";
import {ShellType} from "../app/config/+models/config";

let appBus: AppBus | undefined;
let sideMenuService: SideMenuService | undefined;
let configService: ConfigServiceMock | undefined;
let keybindService: KeybindService | undefined;
let keybindMappingService: KeyboardMappingService | undefined;
let workspaceRepository: WorkspaceRepository | undefined;
let gridListService: GridListService | undefined;
let tabListService: TabListService | undefined;
let terminalComponentFactory: TerminalComponentFactory | undefined;
let windowService: WindowService | undefined;
let focusHandler: FocusHandler | undefined;
let selectionHandler: SelectionHandler | undefined;
let stateManager: TerminalStateManager | undefined;

export function getAppBus(): AppBus {
    if(!appBus) appBus = new AppBus();
    return appBus;
}

export function getStateManager(terminalId: TerminalId = 'test-terminal'): TerminalStateManager {
    if(!stateManager) {
        stateManager = new TerminalStateManager(terminalId, 'Bash', getAppBus());
    }
    return stateManager;
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

export function getWorkspaceRepository(): WorkspaceRepository {
    if(!workspaceRepository) {
        workspaceRepository = new WorkspaceRepository();
    }
    return workspaceRepository;
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
        focusHandler = new FocusHandler(terminalId, getAppBus(), getStateManager(terminalId));
    }
    return focusHandler;
}

export function getSelectionHandler(terminalId: TerminalId): SelectionHandler {
    if(!selectionHandler) {
        selectionHandler = new SelectionHandler(getAppBus(), getConfigService(), terminalId);
    }
    return selectionHandler;
}


export function clear() {
    appBus = undefined;
    sideMenuService = undefined;
    configService = undefined;
    keybindService = undefined;
    keybindMappingService = undefined;
    workspaceRepository = undefined;
    gridListService = undefined;
    tabListService = undefined;
    terminalComponentFactory = undefined;
    windowService = undefined;
    focusHandler = undefined;
    selectionHandler = undefined;
    stateManager = undefined;
}
