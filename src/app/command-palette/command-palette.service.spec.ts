import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CommandPaletteService } from './command-palette.service';
import { AppBus } from '../app-bus/app-bus';
import { ConfigService } from '../config/+state/config.service';
import { KeybindService } from '../keybinding/keybind.service';
import { SideMenuService } from '../menu/side-menu/+state/side-menu.service';
import { DestroyRef } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ACTION_NAMES } from '../action/action.models';
import {Config} from "../config/+models/config";

describe('CommandPaletteService', () => {
    let service: CommandPaletteService;
    let appBus: AppBus;
    let configService: any;
    let keybindService: any;
    let sideMenuService: SideMenuService;
    let destroyRef: any;

    const mockConfig: Partial<Config> = {
        keybind: [
            'ctrl+p=open_command_palette',
            'ctrl+f=copy'
        ],
        command_palette: { mode: 'visible' }
    };

    beforeEach(() => {
        appBus = new AppBus();
        sideMenuService = new SideMenuService(appBus);
        
        configService = {
            config$: new BehaviorSubject(mockConfig),
            get config() { return this.config$.value; }
        };

        keybindService = {
            registerListener: vi.fn(),
            unregisterListener: vi.fn(),
            getKeybinding: vi.fn(),
            getActionDefinition: vi.fn()
        };

        destroyRef = {
            onDestroy: vi.fn()
        };

        service = new CommandPaletteService(
            sideMenuService,
            appBus,
            configService as unknown as ConfigService,
            keybindService as unknown as KeybindService,
            destroyRef as unknown as DestroyRef
        );
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('handleOpen', () => {
        beforeEach(() => {
            // Simulate opening the side menu for Command Palette
            appBus.publish({ type: 'SideMenuViewOpened', payload: { label: 'Command Palette' } });
        });

        it('should initialize commands and filter them', () => {
            const list = service.filteredCommandList();
            expect(list.length).toBe(ACTION_NAMES.length);
            expect(list.some(c => c.isSelected)).toBe(true);
            expect(list[0].isSelected).toBe(true);
        });

        it('should apply keybindings from config', () => {
            const list = service.filteredCommandList();
            const copyCmd = list.find(c => c.label === 'copy');
            expect(copyCmd?.keybinding).toBe('ctrl+f');
            
            const paletteCmd = list.find(c => c.label === 'open command palette');
            expect(paletteCmd?.keybinding).toBe('ctrl+p');
        });

        it('should register keybind listeners', () => {
            expect(keybindService.registerListener).toHaveBeenCalledWith(
                'command_palette',
                ['Escape', 'Enter', 'ArrowDown', 'ArrowUp'],
                expect.any(Function)
            );
        });
    });

    describe('filterCommands', () => {
        beforeEach(() => {
            appBus.publish({ type: 'SideMenuViewOpened', payload: { label: 'Command Palette' } });
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
            appBus.publish({ type: 'SideMenuViewOpened', payload: { label: 'Command Palette' } });
            keyHandler = keybindService.registerListener.mock.calls.find(
                (call: any) => call[0] === 'command_palette'
            )[2];
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
            appBus.publish({ type: 'SideMenuViewOpened', payload: { label: 'Command Palette' } });
            keyHandler = keybindService.registerListener.mock.calls.find(
                (call: any) => call[0] === 'command_palette'
            )[2];
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
            
            const newConfig = {
                ...mockConfig,
                keybind: ['ctrl+alt+t=new_tab']
            };
            
            configService.config$.next(newConfig);
            
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
