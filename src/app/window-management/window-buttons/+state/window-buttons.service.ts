import {Injectable} from '@angular/core';
import {IpcChannel} from '../../../../../shared/ipc.chanels';
import {Observable} from 'rxjs';
import {NotificationService} from '../../../+shared/notification/notification.service';
import {GridService} from '../../+state/grid.service';
import {createStore, Store} from '../../../common/store/store';
import {ElectronService} from '../../../+shared/services/electron/electron.service';
import {SettingsService} from '../../../+shared/services/settings/settings.service';
import {UpdateService} from '../../../+shared/services/update/update.service';
import {WorkspacesService} from '../../../workspaces-menu/+state/workspaces.service';
import {Workspace} from '../../../+shared/models/workspace';

export interface WindowButtonsState {
  isMaximized: boolean;
  isFullScreen: boolean;
  isUpdateAvailable: boolean;
}

const initialState = {isMaximized: false, isUpdateAvailable: false, isFullScreen: false};

@Injectable({
  providedIn: 'root'
})
export class WindowButtonsService {

  private store: Store<WindowButtonsState> = createStore('windowbuttons', initialState);
  constructor(
    private readonly electron: ElectronService,
    private readonly settingsService: SettingsService,
    private readonly updateService: UpdateService,
    private readonly notification: NotificationService,
    private readonly workspaceService: WorkspacesService,
    private readonly gridService: GridService) {
  }

  getState(): WindowButtonsState {
    return {...this.store.get(s => s)};
  }

  selectSelectedWorkspace(): Observable<Workspace> {
    return this.workspaceService.selectActiveWorkspace();
  }

  closeWindow(): void {
    if (!this.notification.isAnyOpen() && this.gridService.getIsAnyTabBusy()) {
      this.notification
        .create()
        .title('There is still a process running.')
        .footer('Do you want to close it anyway?')
        .single('warning_closing')
        .place('top-right')
        .dialog('Yes, shutdown and close!', 'No, abort mission!')
        .showAsWarning()
        .subscribe((close: {confirm: boolean } ) => {
          if (close.confirm) {
            this.gridService.closeAllTabs();
            this.electron.send(IpcChannel.Close);
          }
        });
    } else {
      this.gridService.closeAllTabs();
      this.electron.send(IpcChannel.Close);
    }
  }

  minimizeWindow() {
    this.store.update({isMaximized: false});
    this.electron.send(IpcChannel.Minimize);
  }

  toggleMaximizeWindow() {
    if (this.store.get(s => s.isMaximized)) {
      this.store.update({isMaximized: false});
      this.electron.send(IpcChannel.Unmaximize);
    } else {
      this.store.update({isMaximized: true});
      this.electron.send(IpcChannel.Maximize);
    }
  }

  selectIsMaximized(): Observable<boolean> {
    return this.store.select(s => s.isMaximized);
  }

  selectIsUpdateAvailable(): Observable<boolean> {
    return this.store.select(s => s.isUpdateAvailable);
  }

  showUpdateNotification() {
    this.notification.create()
      .title('Woohoo!')
      .body('A new update is available.', 'Do you want to install it?')
      .single('update')
      .place('top-right')
      .dialog('Yes!', 'No, abort mission!')
      .showAsUpdate()
      .subscribe(shouldUpdate => {
          if (shouldUpdate.confirm) {
            this.updateService.installUpdate();
          }
        }
      );
  }

  updateIsMaximised(isMaximized: boolean): void {
    this.store.update({isMaximized: isMaximized});
  }

  updateIsFullScreen(isFullScreen: boolean): void {
    this.store.update({isFullScreen: isFullScreen});
  }

  updateIsUpdateAvailable(isUpdateAvailable: boolean): void {
    this.store.update({isUpdateAvailable});
  }

  selectIsFullScreen(): Observable<boolean> {
    return this.store.select(s => s.isFullScreen);
  }

  selectIsDarkModeAvailable(): Observable<boolean> {
    return this.settingsService.selectIsDarkModeAvailable();
  }

  toggleDarkMode(): void {
    return this.settingsService.toggleDarkMode();
  }

  selectIsInDarkMode(): Observable<boolean> {
    return this.settingsService.selectIsInDarkMode();
  }

  openNewWindow() {
    this.electron.send(IpcChannel.OpenNewWindow);
  }
}
