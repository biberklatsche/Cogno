import {WindowButtonsComponent} from './window-buttons.component';
import {
  clear,
  getElectronService, getGlobalMenuService,
  getGridService, getNotificationService,
  getSettingsService,
  getUpdateService, getWorkspaceService
} from '../../../../test/factory';
import {WindowButtonsService} from './+state/window-buttons.service';
import {ElectronService} from '../../+shared/services/electron/electron.service';
import {IpcChannel} from '../../../../shared/ipc.chanels';
import {GlobalMenuService} from '../../+shared/abstract-components/menu/+state/global-menu.service';
import {MenuType} from '../../+shared/abstract-components/menu/menuType';


describe('WindowButtonComponent', () => {
  let component: WindowButtonsComponent;
  let service: WindowButtonsService;
  let electronService: ElectronService;
  let menuService: GlobalMenuService;

  beforeEach(() => {
    clear();
    electronService = getElectronService();
    menuService = getGlobalMenuService();
    service = new WindowButtonsService(
      electronService,
      getSettingsService(),
      getUpdateService(),
      getNotificationService(),
      getWorkspaceService(),
      getGridService()
      );
    component = new WindowButtonsComponent(service, menuService);
  });

  it('should minimize window', () => {
    jest.spyOn(electronService, 'send').mockImplementation((channel: string) => {});
    component.minimize();
    expect(service.getState().isMaximized).toEqual(false);
    expect(electronService.send).toBeCalledWith(IpcChannel.Minimize);
  });

  it('should maximize window', () => {
    jest.spyOn(electronService, 'send').mockImplementation((channel: string) => {});
    component.toggleMaximize();
    expect(service.getState().isMaximized).toEqual(true);
    expect(electronService.send).toBeCalledWith(IpcChannel.Maximize);
    component.toggleMaximize();
    expect(service.getState().isMaximized).toEqual(false);
    expect(electronService.send).toBeCalledWith(IpcChannel.Unmaximize);
  });

  it('should toggle workspace', () => {
    jest.spyOn(menuService, 'toggleMenu').mockImplementation((type: MenuType) => {});
    component.toggleWorkspace();
    expect(menuService.toggleMenu).toBeCalledWith('Workspaces');
  });

  it('should open new window', () => {
    jest.spyOn(electronService, 'send').mockImplementation((channel: string) => {});
    component.openNewWindow();
    expect(electronService.send).toBeCalledWith(IpcChannel.OpenNewWindow);
  });
});
