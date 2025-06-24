import {Injectable} from '@angular/core';
import {Position} from '../../../../../shared/models/models';
import {SplitDirection} from '../../../+shared/models/pane';
import {GlobalMenuService} from '../../../+shared/abstract-components/menu/+state/global-menu.service';
import {GridService} from '../../+state/grid.service';
import {createStore, Store} from '../../../common/store/store';
import {Observable} from 'rxjs';
import {MenuService} from '../../../+shared/abstract-components/menu/menu.service';

export interface TabContextMenuState {
  clickPosition: Position;
  tabId: string;
  showAdvancedTab: boolean;
  showAdvancedPane: boolean;
};

@Injectable({
  providedIn: 'root'
})
export class TabContextMenuService extends MenuService {

  private store: Store<TabContextMenuState> = createStore('tabContextMenu', {clickPosition: null, tabId: null, showAdvancedTab: false, showAdvancedPane: false});

  constructor(menuService: GlobalMenuService, private gridService: GridService) {
    super('TabContext', menuService);
  }

  openMenuOnPosition(tabId: string, clickPosition: Position) {
    this.store.update({
      clickPosition,
      tabId,
      showAdvancedPane: this.gridService.getCountPanes() > 1,
      showAdvancedTab: this.gridService.getCountTabs(tabId) > 1
    });
    super.openMenu();
  }

  splitHorizontal() {
    this.gridService.splitPaneWithNewTab(this.store.get(s => s.tabId), SplitDirection.Horizontal);
  }

  splitVertical() {
    this.gridService.splitPaneWithNewTab(this.store.get(s => s.tabId), SplitDirection.Vertical);
  }

  splitAndMoveRight() {
    this.gridService.splitPaneAndMoveTab(this.store.get(s => s.tabId), SplitDirection.Vertical);
  }

  splitAndMoveDown() {
    this.gridService.splitPaneAndMoveTab(this.store.get(s => s.tabId), SplitDirection.Horizontal);
  }

  unsplit() {
    this.gridService.unsplit();
  }

  swap() {
    this.gridService.swap(this.store.get(s => s.tabId));
  }

  closeOtherTabs() {
    this.gridService.closeOtherTabs(this.store.get(s => s.tabId));
  }

  duplicateTab() {
    this.gridService.duplicateTab(this.store.get(s => s.tabId));
  }

  closeTab() {
    this.gridService.closeTabs(this.store.get(s => s.tabId));
  }

  closeAllTabs() {
    this.gridService.closeAllTabs();
  }

  getClickPosition(): Position {
    return this.store.get(s => s.clickPosition);
  }

  selectShowAdvancedTab(): Observable<boolean> {
    return this.store.select(s => s.showAdvancedTab);
  }

  selectShowAdvancedPane(): Observable<boolean> {
    return this.store.select(s => s.showAdvancedPane);
  }
}
