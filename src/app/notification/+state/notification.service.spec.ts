import {describe, it, expect, vi, beforeEach, afterEach, Mocked, Mock} from 'vitest';
import { NotificationService } from './notification.service';
import { AppBus } from '../../app-bus/app-bus';
import { ConfigService } from '../../config/+state/config.service';
import { KeybindService } from '../../keybinding/keybind.service';
import { SideMenuService } from '../../menu/side-menu/+state/side-menu.service';
import { DestroyRef } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Hash } from '../../common/hash/hash';
import {Config} from "../../config/+models/config";

type MockConfigService = Partial<ConfigService> & {
    config$: BehaviorSubject<Partial<Config>>;
    readonly config: Partial<Config>;
};

type MockKeybindService = {
    registerListener: Mock;
    unregisterListener: Mock;
};

type MockDestroyRef = {
    onDestroy: Mock;
};

describe('NotificationService', () => {
    let service: NotificationService;
    let appBus: AppBus;
    let sideMenuService: SideMenuService;

    let configService: MockConfigService;
    let keybindService: MockKeybindService;
    let destroyRef: MockDestroyRef;

    const mockConfig: Partial<Config> = {
        notification: { mode: 'visible' }
    };

    beforeEach(() => {
        appBus = new AppBus();
        sideMenuService = new SideMenuService(appBus);

        configService = {
            config$: new BehaviorSubject<Partial<Config>>(mockConfig),
            get config() { return this.config$.value; }
        };

        keybindService = {
            registerListener: vi.fn(),
            unregisterListener: vi.fn(),
        };

        destroyRef = {
            onDestroy: vi.fn()
        };

        // Spy on sideMenuService.updateIcon via the bus or directly if possible
        // Note: SideMenuService uses signals, so we might need to check the signals if they were accessible
        // but here we check the interaction through SideMenuFeature which calls sideMenuService.
        vi.spyOn(sideMenuService, 'updateIcon');
        vi.spyOn(sideMenuService, 'close');

        service = new NotificationService(
            sideMenuService,
            appBus,
            configService as unknown as ConfigService,
            keybindService as unknown as KeybindService,
            destroyRef as unknown as DestroyRef
        );
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

        it('should register Escape key when opened', () => {
            appBus.publish({ type: 'SideMenuViewOpened', payload: { label: 'Notification' } });
            expect(keybindService.registerListener).toHaveBeenCalledWith(
                'notification',
                ['Escape'],
                expect.any(Function)
            );
        });

        it('should unregister keybind listener when closed', () => {
            appBus.publish({ type: 'SideMenuViewClosed', payload: { label: 'Notification' } });
            expect(keybindService.unregisterListener).toHaveBeenCalledWith('notification');
        });

        it('should stop listener when mode is set to off', () => {
            // Initially it is on (from mockConfig)
            // Change mode to off
            configService.config$.next({ notification: { mode: 'off' } });
            
            // Now publishing a notification should NOT add it
            const payload = { header: 'Ghost', body: 'Should not see me' };
            appBus.publish({ type: 'Notification', path: ['notification'], payload });

            expect(service.notifications().length).toBe(0);
        });

        it('should restart listener when mode is changed back from off', () => {
            configService.config$.next({ notification: { mode: 'off' } });
            configService.config$.next({ notification: { mode: 'visible' } });

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
