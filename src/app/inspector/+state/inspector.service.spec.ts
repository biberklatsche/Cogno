import { describe, it, expect, vi, beforeEach, afterEach, Mocked } from 'vitest';
import { InspectorService } from './inspector.service';
import { AppBus } from '../../app-bus/app-bus';
import { KeybindService } from '../../keybinding/keybind.service';
import { SideMenuService } from '../../menu/side-menu/+state/side-menu.service';
import { DestroyRef } from '@angular/core';
import {
    clear,
    getAppBus,
    getConfigService,
    getDestroyRef,
    getKeybindService, getSideMenuService
} from "../../../__test__/test-factory";
import {ConfigServiceMock} from "../../../__test__/mocks/config-service.mock";

describe('InspectorService', () => {
    let service: InspectorService;
    let appBus: AppBus;
    let configService: ConfigServiceMock;
    let keybindService: KeybindService;
    let sideMenuService: SideMenuService;
    let destroyRef: DestroyRef;


    beforeEach(() => {
        appBus = getAppBus();
        sideMenuService = getSideMenuService();
        configService = getConfigService();
        configService.setConfig({
            inspector: { mode: 'visible' }
        });

        keybindService = getKeybindService();
        vi.spyOn(keybindService, 'registerListener');
        vi.spyOn(keybindService, 'unregisterListener');

        destroyRef = getDestroyRef();

        // Spy on methods called by SideMenuFeature
        vi.spyOn(sideMenuService, 'addMenuItem');
        vi.spyOn(sideMenuService, 'removeMenuItem');
        vi.spyOn(sideMenuService, 'close');

        service = new InspectorService(
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

    describe('Event Handling when Open', () => {
        beforeEach(() => {
            // Open the inspector
            appBus.publish({ type: 'SideMenuViewOpened', payload: { label: 'Inspector' } });
        });

        it('should update firedKeybinding on keybind event', () => {
            const keybinding = { shortcut: 'Ctrl+C', action: 'copy' };
            appBus.publish({
                type: 'Inspector',
                path: ['inspector'],
                payload: { type: 'keybind', data: keybinding }
            });

            expect(service.firedKeybinding()).toEqual(keybinding);
        });

        it('should update terminal state on terminal-state event', () => {
            const data: any = { 
                terminalId: 'term1', 
                mousePosition: { col: 10, row: 5, char: 'A', viewport: { col: 10, row: 5 } },
                cursorPosition: { col: 2, row: 3, char: '_', viewport: { col: 2, row: 3 } },
                dimensions: { cols: 80, rows: 24 }
            };
            appBus.publish({
                type: 'Inspector',
                path: ['inspector'],
                payload: { type: 'terminal-state', data }
            });

            expect(service.terminalStateById()['term1']).toEqual(data);
            expect(service.terminalIds()).toContain('term1');
        });

        it('should track global mouse movement', () => {
            const mouseEvent = new MouseEvent('mousemove', { clientX: 100, clientY: 200 });
            window.dispatchEvent(mouseEvent);

            expect(service.globalMousePosition()).toEqual({ x: 100, y: 200 });
        });

        it('should remove terminal data on TerminalRemoved event', () => {
            // Setup data first
            appBus.publish({
                type: 'Inspector',
                path: ['inspector'],
                payload: { type: 'terminal-state', data: { terminalId: 'term1', mousePosition: { col: 1 } } }
            });
            expect(service.terminalIds()).toContain('term1');

            // Trigger removal
            appBus.publish({
                type: 'TerminalRemoved',
                path: ['app', 'terminal'],
                payload: 'term1'
            });

            expect(service.terminalStateById()['term1']).toBeUndefined();
            expect(service.terminalIds()).not.toContain('term1');
        });

        it('should register Escape key listener', () => {
            expect(keybindService.registerListener).toHaveBeenCalledWith(
                'inspector',
                ['Escape'],
                expect.any(Function)
            );
        });
    });

    describe('Lifecycle and Modes', () => {
        it('should unregister listeners when closed', () => {
            appBus.publish({ type: 'SideMenuViewOpened', payload: { label: 'Inspector' } });
            appBus.publish({ type: 'SideMenuViewClosed', payload: { label: 'Inspector' } });

            expect(keybindService.unregisterListener).toHaveBeenCalledWith('inspector');
        });

        it('should stop listening to events when closed', () => {
            appBus.publish({ type: 'SideMenuViewOpened', payload: { label: 'Inspector' } });
            appBus.publish({ type: 'SideMenuViewClosed', payload: { label: 'Inspector' } });

            const keybinding = { shortcut: 'Ctrl+V', action: 'paste' };
            appBus.publish({
                type: 'Inspector',
                path: ['inspector'],
                payload: { type: 'keybind', data: keybinding }
            });

            expect(service.firedKeybinding()).toBeUndefined();
        });

        it('should handle mode off by closing', () => {
            appBus.publish({ type: 'SideMenuViewOpened', payload: { label: 'Inspector' } });
            
            configService.setConfig({ inspector: { mode: 'off' } } as any);

            expect(sideMenuService.removeMenuItem).toHaveBeenCalledWith('Inspector');
            // Check if keybind listener was unregistered via handleClose
            expect(keybindService.unregisterListener).toHaveBeenCalledWith('inspector');
        });
    });
});
