import {describe, it, expect, vi, beforeEach, afterEach, Mocked, Mock} from 'vitest';
import { NotificationService } from './notification.service';
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

describe('NotificationService', () => {
    let service: NotificationService;
    let appBus: AppBus;
    let sideMenuService: SideMenuService;
    let configService: ConfigServiceMock;
    let keybindService: KeybindService;
    let destroyRef: DestroyRef;


    beforeEach(() => {
        appBus = getAppBus();
        sideMenuService = getSideMenuService();
        configService = getConfigService();
        configService.setConfig({
            notification: { mode: 'visible' }
        });

        keybindService = getKeybindService();
        vi.spyOn(keybindService, 'registerListener');
        vi.spyOn(keybindService, 'unregisterListener');

        destroyRef = getDestroyRef();

        // Spy on sideMenuService.updateIcon via the bus or directly if possible
        vi.spyOn(sideMenuService, 'updateIcon');
        vi.spyOn(sideMenuService, 'close');

        service = new NotificationService(
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

    it('should be created and start listening', () => {
        expect(service).toBeTruthy();
        // It should have initialized the listener in constructor
    });

    describe('Notification Handling', () => {
        it('should add a new notification when a Notification event is published', () => {
            const payload = { header: 'Test Header', body: 'Test Body', type: 'info' as const };
            appBus.publish({ type: 'Notification', path: ['notification'], payload });

            const notifications = service.notifications();
            expect(notifications.length).toBe(1);
            expect(notifications[0].header).toBe('Test Header');
            expect(notifications[0].body).toBe('Test Body');
            expect(notifications[0].type).toBe('info');
            expect(notifications[0].count).toBe(1);
        });

        it('should increment count for duplicate notifications', () => {
            const payload = { header: 'Test Header', body: 'Test Body' };
            appBus.publish({ type: 'Notification', path: ['notification'], payload });
            appBus.publish({ type: 'Notification', path: ['notification'], payload });

            const notifications = service.notifications();
            expect(notifications.length).toBe(1);
            expect(notifications[0].count).toBe(2);
        });

        it('should update icon to mdiBellBadge when a notification arrives', () => {
            const payload = { header: 'Test Header', body: 'Test Body' };
            appBus.publish({ type: 'Notification', path: ['notification'], payload });

            expect(sideMenuService.updateIcon).toHaveBeenCalledWith('Notification', 'mdiBellBadge');
        });

        it('should use default type info if none provided', () => {
            const payload = { header: 'Test Header', body: 'Test Body' };
            appBus.publish({ type: 'Notification', path: ['notification'], payload });

            const notifications = service.notifications();
            expect(notifications[0].type).toBe('info');
        });
    });

    describe('Lifecycle and State', () => {
        it('should clear badge when opened', () => {
            appBus.publish({ type: 'SideMenuViewOpened', payload: { label: 'Notification' } });
            expect(sideMenuService.updateIcon).toHaveBeenCalledWith('Notification', 'mdiBell');
        });

        it('should register Escape key when focused', () => {
            appBus.publish({ type: 'SideMenuViewFocused', payload: { label: 'Notification' } });
            expect(keybindService.registerListener).toHaveBeenCalledWith(
                'notification',
                ['Escape'],
                expect.any(Function)
            );
        });

        it('should unregister keybind listener when blurred', () => {
            appBus.publish({ type: 'SideMenuViewBlurred', payload: { label: 'Notification' } });
            expect(keybindService.unregisterListener).toHaveBeenCalledWith('notification');
        });

        it('should stop listener when mode is set to off', () => {
            // Initially it is on (from mockConfig)
            // Change mode to off
            configService.setConfig({ notification: { mode: 'off' } } as any);
            
            // Now publishing a notification should NOT add it
            const payload = { header: 'Ghost', body: 'Should not see me' };
            appBus.publish({ type: 'Notification', path: ['notification'], payload });

            expect(service.notifications().length).toBe(0);
        });

        it('should restart listener when mode is changed back from off', () => {
            configService.setConfig({ notification: { mode: 'off' } } as any);
            configService.setConfig({ notification: { mode: 'visible' } } as any);

            const payload = { header: 'I am back', body: 'Hello' };
            appBus.publish({ type: 'Notification', path: ['notification'], payload });

            expect(service.notifications().length).toBe(1);
        });
    });

    describe('Public API', () => {
        it('should remove a notification by id', () => {
            const payload = { header: 'Delete Me', body: 'Bye' };
            appBus.publish({ type: 'Notification', path: ['notification'], payload });
            
            const id = service.notifications()[0].id;
            service.remove(id);

            expect(service.notifications().length).toBe(0);
        });

        it('should clear all notifications', () => {
            appBus.publish({ type: 'Notification', path: ['notification'], payload: { header: '1', body: 'a' } });
            appBus.publish({ type: 'Notification', path: ['notification'], payload: { header: '2', body: 'b' } });

            expect(service.notifications().length).toBe(2);
            service.clear();
            expect(service.notifications().length).toBe(0);
            expect(sideMenuService.updateIcon).toHaveBeenCalledWith('Notification', 'mdiBell');
        });

        it('should return correct notification count', () => {
            appBus.publish({ type: 'Notification', path: ['notification'], payload: { header: '1', body: 'a' } });
            appBus.publish({ type: 'Notification', path: ['notification'], payload: { header: '2', body: 'b' } });

            expect(service.getNotificationCount()).toBe(2);
        });
    });
});
