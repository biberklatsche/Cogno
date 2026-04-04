import {describe, it, expect, beforeEach, vi} from 'vitest';
import {SideMenuService, SideMenuItem} from './side-menu.service';
import {AppBus} from '../../../app-bus/app-bus';

class DummyComponent {}

describe('SideMenuService', () => {
    let bus: AppBus;
    let service: SideMenuService;
    let menuItem: SideMenuItem;

    beforeEach(() => {
        bus = new AppBus();
        service = new SideMenuService(bus);
        menuItem = {
            label: 'Workspace',
            icon: 'mdiViewDashboard',
            hidden: false,
            pinned: false,
            actionName: 'open_workspace',
            component: DummyComponent,
        };
        service.addMenuItem(menuItem);
    });

    it('should focus when opening a side menu item', () => {
        const publishSpy = vi.spyOn(bus, 'publish');

        service.open('Workspace');
        const publishedTypes = publishSpy.mock.calls.map(call => call[0].type);

        expect(service.selectedItem()?.label).toBe('Workspace');
        expect(service.isFocused()).toBe(true);
        expect(publishedTypes).toContain('SideMenuViewOpened');
        expect(publishedTypes).toContain('SideMenuViewFocused');
    });

    it('should only blur when pinned item loses outside focus', () => {
        const publishSpy = vi.spyOn(bus, 'publish');

        service.open('Workspace');
        service.togglePin();
        service.blur();
        const publishedTypes = publishSpy.mock.calls.map(call => call[0].type);

        expect(service.selectedItem()?.label).toBe('Workspace');
        expect(service.selectedItem()?.pinned).toBe(true);
        expect(service.isFocused()).toBe(false);
        expect(publishedTypes).toContain('SideMenuViewBlurred');
    });

    it('should close and blur on close()', () => {
        const publishSpy = vi.spyOn(bus, 'publish');

        service.open('Workspace');
        service.close();
        const publishedTypes = publishSpy.mock.calls.map(call => call[0].type);

        expect(service.selectedItem()).toBeUndefined();
        expect(service.isFocused()).toBe(false);
        expect(publishedTypes).toContain('SideMenuViewClosed');
        expect(publishedTypes).toContain('SideMenuViewBlurred');
    });

    it('should only blur on close() when selected item is pinned', () => {
        const publishSpy = vi.spyOn(bus, 'publish');

        service.open('Workspace');
        service.togglePin();
        publishSpy.mockClear();

        service.close();
        const publishedTypes = publishSpy.mock.calls.map(call => call[0].type);

        expect(service.selectedItem()?.label).toBe('Workspace');
        expect(service.selectedItem()?.pinned).toBe(true);
        expect(service.isFocused()).toBe(false);
        expect(publishedTypes).toContain('SideMenuViewBlurred');
        expect(publishedTypes).not.toContain('SideMenuViewClosed');
    });

    it('should close pinned item when close is forced', () => {
        const publishSpy = vi.spyOn(bus, 'publish');

        service.open('Workspace');
        service.togglePin();
        publishSpy.mockClear();

        service.close(true);
        const publishedTypes = publishSpy.mock.calls.map(call => call[0].type);

        expect(service.selectedItem()).toBeUndefined();
        expect(service.isFocused()).toBe(false);
        expect(publishedTypes).toContain('SideMenuViewClosed');
    });

    it('should re-focus the same item when open is called again', () => {
        const publishSpy = vi.spyOn(bus, 'publish');

        service.open('Workspace');
        service.blur();
        publishSpy.mockClear();

        service.open('Workspace');
        const publishedTypes = publishSpy.mock.calls.map(call => call[0].type);

        expect(service.selectedItem()?.label).toBe('Workspace');
        expect(service.isFocused()).toBe(true);
        expect(publishedTypes).toContain('SideMenuViewFocused');
        expect(publishedTypes).not.toContain('SideMenuViewOpened');
    });

    it('should clamp side menu panel width', () => {
        service.setPanelWidthInPixels(100);
        expect(service.panelWidthInPixels()).toBe(280);

        service.setPanelWidthInPixels(999);
        expect(service.panelWidthInPixels()).toBe(640);
    });
});


