import {describe, it, expect, vi, beforeEach, afterEach, Mocked} from 'vitest';
import { CommandPaletteService } from './command-palette.service';
import { AppBus } from '../app-bus/app-bus';
import { KeybindService } from '../keybinding/keybind.service';
import { SideMenuService } from '../menu/side-menu/+state/side-menu.service';
import { DestroyRef } from '@angular/core';
import { ACTION_NAMES } from '../action/action.models';
import {Config} from "../config/+models/config";
import {
    clear,
    getAppBus, getConfigService, getDestroyRef, getKeybindService, getSideMenuService
} from "../../__test__/test-factory";
import {ConfigServiceMock} from "../../__test__/mocks/config-service.mock";

describe('CommandPaletteService', () => {
    let service: CommandPaletteService;
    let appBus: AppBus;
    let configService: ConfigServiceMock;
    let keybindService: KeybindService;
    let sideMenuService: SideMenuService;
    let destroyRef: DestroyRef;

    beforeEach(() => {
        sideMenuService = getSideMenuService();
        configService = getConfigService();
        configService.setConfig({
            keybind: [
                'ctrl+p=open_command_palette',
                'ctrl+f=copy'
            ],
            command_palette: { mode: 'visible' }
        })
        keybindService = getKeybindService();
        vi.spyOn(keybindService, 'registerListener');
        vi.spyOn(keybindService, 'unregisterListener');
        appBus = getAppBus();
        destroyRef = getDestroyRef();

        service = new CommandPaletteService(
            sideMenuService,
            appBus,
            configService,
            keybindService,
            destroyRef
        );
    });

    afterEach(() => {
        clear();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('handleOpen', () => {

        it('should initialize commands and filter them', () => {
            sideMenuService.open('Command Palette' );
            const list = service.filteredCommandList();
            expect(list.length).toBe(ACTION_NAMES.length);
            expect(list.some(c => c.isSelected)).toBe(true);
            expect(list[0].isSelected).toBe(true);
        });

        it('should apply keybindings from config', () => {
            sideMenuService.open('Command Palette' );
            const list = service.filteredCommandList();
            const copyCmd = list.find(c => c.label === 'copy');
            expect(copyCmd?.keybinding).toBe('ctrl+f');
            
            const paletteCmd = list.find(c => c.label === 'open command palette');
            expect(paletteCmd?.keybinding).toBe('ctrl+p');
        });

        it('should register keybind listeners', () => {
            vi.spyOn(keybindService, 'registerListener');
            sideMenuService.open('Command Palette' );
            expect(keybindService.registerListener).toHaveBeenCalledWith(
                'command_palette',
                ['Escape', 'Enter', 'ArrowDown', 'ArrowUp'],
                expect.any(Function)
            );
        });
    });

    describe('filterCommands', () => {
        beforeEach(() => {
            sideMenuService.open('Command Palette' );
        });

        it('should filter commands by label', () => {
            service.filterCommands('copy');
            const list = service.filteredCommandList();
            expect(list.length).toBe(1);
            expect(list[0].label).toBe('copy');
            expect(list[0].isSelected).toBe(true);
        });

        it('should be case-insensitive', () => {
            service.filterCommands('COPY');
            const list = service.filteredCommandList();
            expect(list.length).toBe(1);
            expect(list[0].label).toBe('copy');
        });

        it('should select first item after filtering', () => {
            service.filterCommands('split');
            const list = service.filteredCommandList();
            expect(list.length).toBeGreaterThan(1);
            expect(list[0].isSelected).toBe(true);
            expect(list.slice(1).every(c => !c.isSelected)).toBe(true);
        });
    });

    describe('Navigation', () => {
        let keyHandler: (evt: any) => void;

        beforeEach(() => {
            sideMenuService.open('Command Palette' );
            keyHandler = vi.mocked(keybindService.registerListener).mock.calls.find(
                (call: any) => call[0] === 'command_palette'
            )![2];
        });

        it('should navigate down with ArrowDown', () => {
            const initialList = service.filteredCommandList();
            expect(initialList[0].isSelected).toBe(true);

            keyHandler({ key: 'ArrowDown' });
            
            const updatedList = service.filteredCommandList();
            expect(updatedList[0].isSelected).toBe(false);
            expect(updatedList[1].isSelected).toBe(true);
        });

        it('should navigate up with ArrowUp', () => {
            keyHandler({ key: 'ArrowDown' }); // move to second
            keyHandler({ key: 'ArrowUp' });   // move back to first
            
            const updatedList = service.filteredCommandList();
            expect(updatedList[0].isSelected).toBe(true);
        });

        it('should wrap around when navigating', () => {
            const list = service.filteredCommandList();
            // Move up from first should go to last
            keyHandler({ key: 'ArrowUp' });
            expect(service.filteredCommandList()[list.length - 1].isSelected).toBe(true);

            // Move down from last should go to first
            keyHandler({ key: 'ArrowDown' });
            expect(service.filteredCommandList()[0].isSelected).toBe(true);
        });
    });

    describe('Actions', () => {
        let keyHandler: (evt: any) => void;

        beforeEach(() => {
            vi.useFakeTimers();
            sideMenuService.open('Command Palette');
            keyHandler = vi.mocked(keybindService.registerListener).mock.calls.find(
                (call: any) => call[0] === 'command_palette'
            )![2];
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should fire action and close on Enter', () => {
            const publishSpy = vi.spyOn(appBus, 'publish');
            const closeSpy = vi.spyOn(sideMenuService, 'close');

            const selectedAction = service.filteredCommandList()[0].action;

            keyHandler({ key: 'Enter' });
            
            vi.runAllTimers();

            expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
                type: 'ActionFired',
                payload: selectedAction.actionName
            }));
            expect(closeSpy).toHaveBeenCalled();
        });

        it('should close on Escape', () => {
            const closeSpy = vi.spyOn(sideMenuService, 'close');
            keyHandler({ key: 'Escape' });
            expect(closeSpy).toHaveBeenCalled();
        });

        it('should fire specific action via fireAction', () => {
            const publishSpy = vi.spyOn(appBus, 'publish');
            const command = service.filteredCommandList()[1];
            
            service.fireAction(command);
            vi.runAllTimers();

            expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
                type: 'ActionFired',
                payload: command.action.actionName
            }));
        });
    });

    describe('Config Changes', () => {
        it('should update command list when config changes', () => {
            appBus.publish({ type: 'SideMenuViewOpened', payload: { label: 'Command Palette' } });
            
            const newConfig: Config = {
                keybind: ['ctrl+alt+t=new_tab'],
                command_palette: { mode: 'visible' }
            } as Config;
            
            configService.setConfig(newConfig);
            
            const list = service.filteredCommandList();
            const newTabCmd = list.find(c => c.label === 'new tab');
            expect(newTabCmd?.keybinding).toBe('ctrl+alt+t');
        });
    });

    describe('handleClose', () => {
        it('should clear lists and unregister listeners when closed', () => {
            appBus.publish({ type: 'SideMenuViewOpened', payload: { label: 'Command Palette' } });
            expect(service.filteredCommandList().length).toBeGreaterThan(0);

            appBus.publish({ type: 'SideMenuViewClosed', payload: { label: 'Command Palette' } });

            expect(service.filteredCommandList().length).toBe(0);
            expect(keybindService.unregisterListener).toHaveBeenCalledWith('command_palette');
        });
    });
});
