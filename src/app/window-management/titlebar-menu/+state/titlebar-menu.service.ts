import {Injectable, OnDestroy} from '@angular/core';
import {Position, TabType} from '../../../../../shared/models/models';
import {Key} from '../../../common/key';
import {ShellConfig} from '../../../../../shared/models/settings';
import {GlobalMenuService} from '../../../+shared/abstract-components/menu/+state/global-menu.service';
import {WindowManagementService} from '../../+state/window-management.service';
import {ElectronService} from '../../../+shared/services/electron/electron.service';
import {createStore, Store} from '../../../common/store/store';
import {SettingsService} from '../../../+shared/services/settings/settings.service';
import {Observable, Subscription} from 'rxjs';
import {MenuService} from '../../../+shared/abstract-components/menu/menu.service';

export interface TitlebarMenuState {
  shellConfigs: ShellConfig[];
  paneId: string;
  clickPosition: Position;
};

@Injectable({
  providedIn: 'root'
})
export class TitlebarMenuService extends MenuService implements OnDestroy{

  private store: Store<TitlebarMenuState> = createStore('contextMenu', {shellConfigs: [], selectedShellConfig: null, paneId: null, clickPosition: null});

  private subscriptions: Subscription[] = [];

  constructor(private menuService: GlobalMenuService, private electron: ElectronService, private settingsService: SettingsService, private gridService: WindowManagementService) {
    super('TitleBar', menuService);
    this.subscriptions.push(this.settingsService.selectShells().subscribe(shellConfigs => {
      this.store.update({shellConfigs});
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  openMenuOnPosition(paneId: string, position: Position) {
    this.store.update({paneId, clickPosition: position});
    this.menuService.toggleMenu('TitleBar');
  }

  public openShell(tabType: TabType, shellConfig?: ShellConfig) {
    this.gridService.addNewTab(this.store.get(s => s.paneId), tabType, shellConfig);
    this.globalMenuService.updateCurrentActiveMenu('AllClosed');
  }

  public openReportIssue() {
    this.electron.openReportIssue();
    this.globalMenuService.updateCurrentActiveMenu('AllClosed');
  }

  public openDonation() {
    this.electron.openDonation();
    this.globalMenuService.updateCurrentActiveMenu('AllClosed');
  }

  openReddit() {
    this.electron.openReddit();
    this.globalMenuService.updateCurrentActiveMenu('AllClosed');
  }

  public openSettings() {
    this.gridService.addNewTab(this.store.get(s => s.paneId), TabType.Settings);
    this.globalMenuService.updateCurrentActiveMenu('AllClosed');
  }

  public openAbout() {
    this.gridService.addNewTab(this.store.get(s => s.paneId), TabType.About);
    this.globalMenuService.updateCurrentActiveMenu('AllClosed');
  }

  public openReleaseNotes() {
    this.gridService.addNewTab(this.store.get(s => s.paneId), TabType.ReleaseNotes);
    this.globalMenuService.updateCurrentActiveMenu('AllClosed');
  }

  selectShellConfigs(): Observable<ShellConfig[]> {
    return this.store.select(s => s.shellConfigs);
  }

  getClickPosition(): Position {
    return this.store.get(s => s.clickPosition);
  }
}
