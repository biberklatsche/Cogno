import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TabListService } from './tab-list.service';
import { AppBus } from '../../app-bus/app-bus';
import { clear, getAppBus, getConfigService, getDestroyRef } from "../../../__test__/test-factory";
import { ConfigServiceMock } from "../../../__test__/mocks/config-service.mock";
import { IdCreator } from "../../common/id-creator/id-creator";
import { Tab } from '../+model/tab';

describe('TabListService', () => {
    let service: TabListService;
    let bus: AppBus;
    let configService: ConfigServiceMock;

    beforeEach(() => {
        bus = getAppBus();
        configService = getConfigService();
        configService.setConfig({
            shell: {
                default: 'test',
                profiles: {
                    'test': {
                        shell_type: 'PowerShell',
                        inject_cogno_cli: true,
                        enable_shell_integration: true
                    }
                }
            }
        });
        
        service = new TabListService(bus, configService, getDestroyRef());
    });

    afterEach(() => {
        clear();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('Event Handling', () => {
        it('should handle SelectTab event', () => {
            const tab: Tab = { id: 't1', title: 'T1', isActive: false, activeShellType: 'unknown' };
            service.addTab(tab);
            
            const spy = vi.spyOn(service, 'selectTab');
            const event = { type: 'SelectTab', payload: 't1' } as any;
            bus.publish(event);

            expect(spy).toHaveBeenCalledWith('t1');
            expect(event.propagationStopped).toBe(true);
        });

        it('should handle RemoveTab event', () => {
            const tab: Tab = { id: 't1', title: 'T1', isActive: true, activeShellType: 'unknown' };
            service.addTab(tab);

            const spy = vi.spyOn(service, 'removeTab');
            const event = { type: 'RemoveTab', payload: 't1' } as any;
            bus.publish(event);

            expect(spy).toHaveBeenCalledWith('t1');
            expect(event.propagationStopped).toBe(true);
        });

        it('should handle TabTitleChanged event', () => {
            const tab: Tab = { id: 't1', title: 'Old Title', isActive: true, activeShellType: 'unknown' };
            service.addTab(tab);

            const event = { 
                type: 'TabTitleChanged',
                payload: { tabId: 't1', title: 'New Title' }
            } as any;
            bus.publish(event);

            let currentTabs: Tab[] = [];
            service.tabs$.subscribe(tabs => currentTabs = tabs);
            expect(currentTabs[0].title).toBe('New Title');
            expect(event.propagationStopped).toBe(true);
        });
    });

    describe('ActionFired events', () => {
        it('should handle new_tab action', () => {
            vi.spyOn(IdCreator, 'newTabId').mockReturnValue('new-t');
            const spy = vi.spyOn(service, 'addTab');
            
            const event = { 
                type: 'ActionFired', 
                payload: 'new_tab', 
                path: ['app', 'action'],
                trigger: { all: false }
            } as any;
            bus.publish(event);

            expect(spy).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-t', title: 'Shell' }));
            expect(event.performed).toBe(true);
            expect(event.defaultPrevented).toBe(true);
        });

        it('should handle close_tab action', () => {
            const tab: Tab = { id: 't1', title: 'T1', isActive: true, activeShellType: 'unknown' };
            service.addTab(tab);
            const spy = vi.spyOn(service, 'removeTab');

            const event = { 
                type: 'ActionFired', 
                payload: 'close_tab', 
                path: ['app', 'action'],
                trigger: { all: false }
            } as any;
            bus.publish(event);

            expect(spy).toHaveBeenCalledWith('t1');
            expect(event.performed).toBe(true);
        });

        it('should handle close_other_tabs action', () => {
            service.addTab({ id: 't1', title: 'T1', isActive: false, activeShellType: 'unknown' });
            service.addTab({ id: 't2', title: 'T2', isActive: true, activeShellType: 'unknown' });
            const spy = vi.spyOn(service, 'removeAllTabs');

            const event = { 
                type: 'ActionFired', 
                payload: 'close_other_tabs', 
                path: ['app', 'action']
            } as any;
            bus.publish(event);

            expect(spy).toHaveBeenCalledWith('t2');
            expect(event.performed).toBe(true);
        });

        it('should handle close_all_tabs action', () => {
            const spy = vi.spyOn(service, 'removeAllTabs');

            const event = { 
                type: 'ActionFired', 
                payload: 'close_all_tabs', 
                path: ['app', 'action']
            } as any;
            bus.publish(event);

            expect(spy).toHaveBeenCalled();
            expect(event.performed).toBe(true);
        });
    });

    describe('Tab Management', () => {
        it('should add a tab and publish TabAdded', () => {
            const publishSpy = vi.spyOn(bus, 'publish');
            const tab: Tab = { id: 't1', title: 'T1', isActive: true, activeShellType: 'unknown' };
            
            service.addTab(tab);

            let currentTabs: Tab[] = [];
            service.tabs$.subscribe(tabs => currentTabs = tabs);
            expect(currentTabs.length).toBe(1);
            expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
                type: 'TabAdded',
                payload: { tabId: 't1', isActive: true }
            }));
        });

        it('should not add duplicate tab', () => {
            const tab: Tab = { id: 't1', title: 'T1', isActive: true, activeShellType: 'unknown' };
            service.addTab(tab);
            service.addTab(tab);

            let currentTabs: Tab[] = [];
            service.tabs$.subscribe(tabs => currentTabs = tabs);
            expect(currentTabs.length).toBe(1);
        });

        it('should deactivate other tabs when adding an active tab', () => {
            service.addTab({ id: 't1', title: 'T1', isActive: true, activeShellType: 'unknown' });
            service.addTab({ id: 't2', title: 'T2', isActive: true, activeShellType: 'unknown' });

            let currentTabs: Tab[] = [];
            service.tabs$.subscribe(tabs => currentTabs = tabs);
            expect(currentTabs.find(t => t.id === 't1')?.isActive).toBe(false);
            expect(currentTabs.find(t => t.id === 't2')?.isActive).toBe(true);
        });

        it('should remove a tab and publish TabRemoved', () => {
            const publishSpy = vi.spyOn(bus, 'publish');
            service.addTab({ id: 't1', title: 'T1', isActive: true, activeShellType: 'unknown' });
            
            service.removeTab('t1');

            let currentTabs: Tab[] = [];
            service.tabs$.subscribe(tabs => currentTabs = tabs);
            expect(currentTabs.length).toBe(0);
            expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
                type: 'TabRemoved',
                payload: 't1'
            }));
        });

        it('should select next tab when active tab is removed', () => {
            service.addTab({ id: 't1', title: 'T1', isActive: false, activeShellType: 'unknown' });
            service.addTab({ id: 't2', title: 'T2', isActive: true, activeShellType: 'unknown' });
            
            service.removeTab('t2');

            let currentTabs: Tab[] = [];
            service.tabs$.subscribe(tabs => currentTabs = tabs);
            expect(currentTabs[0].isActive).toBe(true);
        });

        it('should select a tab', () => {
            service.addTab({ id: 't1', title: 'T1', isActive: true, activeShellType: 'unknown' });
            service.addTab({ id: 't2', title: 'T2', isActive: false, activeShellType: 'unknown' });
            
            service.selectTab('t2');

            let currentTabs: Tab[] = [];
            service.tabs$.subscribe(tabs => currentTabs = tabs);
            expect(currentTabs.find(t => t.id === 't1')?.isActive).toBe(false);
            expect(currentTabs.find(t => t.id === 't2')?.isActive).toBe(true);
        });

        it('should remove all tabs except one', () => {
            service.addTab({ id: 't1', title: 'T1', isActive: true, activeShellType: 'unknown' });
            service.addTab({ id: 't2', title: 'T2', isActive: false, activeShellType: 'unknown' });
            
            service.removeAllTabs('t1');

            let currentTabs: Tab[] = [];
            service.tabs$.subscribe(tabs => currentTabs = tabs);
            expect(currentTabs.length).toBe(1);
            expect(currentTabs[0].id).toBe('t1');
        });
    });

    describe('Rename Logic', () => {
        it('should commit rename', () => {
            service.addTab({ id: 't1', title: 'Old', isActive: true, activeShellType: 'unknown' });
            service['_showRename'].set('t1');

            service.commitRename('New Name');

            let currentTabs: Tab[] = [];
            service.tabs$.subscribe(tabs => currentTabs = tabs);
            expect(currentTabs[0].title).toBe('New Name');
            expect(service.showRename$()).toBeUndefined();
        });

        it('should close rename and focus terminal', () => {
            const publishSpy = vi.spyOn(bus, 'publish');
            service.addTab({ id: 't1', title: 'T1', isActive: true, activeShellType: 'unknown' });
            service['_showRename'].set('t1');

            service.closeRename();

            expect(service.showRename$()).toBeUndefined();
            expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
                type: 'FocusActiveTerminal'
            }));
        });
    });

    describe('Context Menu', () => {
        it('should build context menu', () => {
            service.addTab({ id: 't1', title: 'T1', isActive: true, activeShellType: 'unknown' });
            service.addTab({ id: 't2', title: 'T2', isActive: false, activeShellType: 'unknown' });

            const menu = service.buildContextMenu('t1');
            
            expect(menu.find(i => i.label === 'Close tab')).toBeTruthy();
            expect(menu.find(i => i.label === 'Close other tabs')).toBeTruthy();
            expect(menu.find(i => i.label === 'Rename tab')).toBeTruthy();
            expect(menu.find(i => i.colorpicker)).toBeTruthy();
        });

        it('should set color from context menu', () => {
            service.addTab({ id: 't1', title: 'T1', isActive: true, activeShellType: 'unknown' });
            const menu = service.buildContextMenu('t1');
            const colorPicker = menu.find(i => i.colorpicker);
            
            colorPicker!.action!('red');

            let currentTabs: Tab[] = [];
            service.tabs$.subscribe(tabs => currentTabs = tabs);
            expect(currentTabs[0].color).toBe('red');
        });
    });

    describe('Workspace Integration', () => {
        it('should restore tabs from config', () => {
            const configs = [
                { tabId: 'c1', title: 'Conf 1', isActive: true, color: 'blue' as const }
            ];
            
            service.restoreTabs(configs);

            let currentTabs: Tab[] = [];
            service.tabs$.subscribe(tabs => currentTabs = tabs);
            expect(currentTabs.length).toBe(1);
            expect(currentTabs[0].id).toBe('c1');
            expect(currentTabs[0].color).toBe('blue');
        });

        it('should return tab configs', () => {
            service.addTab({ id: 't1', title: 'T1', isActive: true, color: 'green', activeShellType: 'unknown' });
            
            const configs = service.getTabConfigs();
            
            expect(configs.length).toBe(1);
            expect(configs[0].tabId).toBe('t1');
            expect(configs[0].color).toBe('green');
        });
    });
});
