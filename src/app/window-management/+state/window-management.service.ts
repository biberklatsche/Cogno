import {Injectable, OnDestroy} from '@angular/core';
import {BinaryNode, BinaryTree} from '../../common/tree/binary-tree';
import {filter} from 'rxjs/operators';
import {lastValueFrom, Observable, Subject, Subscription} from 'rxjs';
import {createStore, Store} from '../../common/store/store';
import {TabnameBuilder} from './tabname.builder';
import {Pane, SplitDirection} from '../+models/pane';
import {SettingsTabConfig, Tab, TabType, TerminalTab} from '../+models/tab';
import {SettingsService} from '../../settings/+state/settings.service';
import {ShellConfig} from '../../settings/+models/settings';

export interface GridState {
  tree: BinaryTree<Pane>;
  tabs: Tab[];
  activeTabId?: string;
  tabsToRemove: Tab[];
  tabIdToDrag?: string;
}

@Injectable({
  providedIn: 'root'
})
export class WindowManagementService implements OnDestroy {

  private _closeTab = new Subject<string>();
  private _focusTab = new Subject<string>();
  private _gridChanged = new Subject<number>();
  private store: Store<GridState> = createStore<GridState>('grid', {
    tree: new BinaryTree<Pane>(new Pane(true)),
    tabs: [],
    activeTabId: undefined,
    tabsToRemove: [],
    tabIdToDrag: undefined
  });
  private subscriptions: Subscription[] = [];

  constructor(
    private settingsService: SettingsService,
    ) {

    settingsService.onSettingsFirstLoaded.subscribe(() => {
      this.addNewTab(BinaryTree.ROOT_KEY, 'about');
      /*if (updateService.getShowReleaseNotes()) {
        updateService.disableShowReleaseNotes();
        this.addNewTab(BinaryTree.ROOT_KEY, 'release-notes');
      }*/
    });
    /*this.subscriptions.push(
      this.globalMenuService.selectCurrentActiveMenu()
        .pipe(filter(menu => menu === 'AllClosed'))
        .subscribe(() => this.focusActiveTab()),
      this.keyboardService.onShortcut(
        'newTab',
        'closeTab',
        'closeAllTabs',
        'nextTab',
        'changeTab',
        'previousTab',
        'splitAndMoveVertical',
        'splitAndMoveHorizontal',
        'splitVertical',
        'splitHorizontal',
        'unsplit',
        'swapPanes',
        'openSettings',
        'openShell1',
        'openShell2',
        'openShell3',
        'openShell4',
        'openShell5',
        'openShell6',
        'openShell7',
        'openShell8',
        'openShell9',
        'duplicateTab',
        'closeOtherTabs'
      ).subscribe(shortcut => {
        const activeTabId = this.store.get(s => s.activeTabId);
        const activePaneKey = activeTabId ? this.findPaneNodeByTabId(activeTabId).key : BinaryTree.ROOT_KEY;
        switch (shortcut.key) {
          case 'newTab':
            this.addNewTab(activePaneKey, TabType.Terminal, this.settingsService.getDefaultShellConfig());
            break;
          case 'closeTab':
            this.closeTabs(activeTabId);
            break;
          case 'closeOtherTabs':
            this.closeOtherTabs(activeTabId);
            break;
          case 'closeAllTabs':
            this.closeAllTabs();
            break;
          case 'nextTab':
          case 'changeTab':
            this.switchToNextTab(activePaneKey, activeTabId);
            break;
          case 'previousTab':
            this.switchToPreviousTab(activePaneKey, activeTabId);
            break;
          case 'splitAndMoveVertical':
            this.splitPaneAndMoveTab(activeTabId, SplitDirection.Vertical);
            break;
          case 'splitAndMoveHorizontal':
            this.splitPaneAndMoveTab(activeTabId, SplitDirection.Horizontal);
            break;
          case 'splitVertical':
            this.splitPaneWithNewTab(activeTabId, SplitDirection.Vertical);
            break;
          case 'splitHorizontal':
            this.splitPaneWithNewTab(activeTabId, SplitDirection.Horizontal);
            break;
          case 'unsplit':
            this.unsplit();
            break;
          case 'swapPanes':
            this.swap(activeTabId);
            break;
          case 'duplicateTab':
            this.duplicateTab(activeTabId);
            break;
          case 'openSettings':
            this.addNewTab(activePaneKey, TabType.Settings);
            break;
          case 'openShell1':
          case 'openShell2':
          case 'openShell3':
          case 'openShell4':
          case 'openShell5':
          case 'openShell6':
          case 'openShell7':
          case 'openShell8':
          case 'openShell9':
            const shells = this.settingsService.getShells();
            const index = Number.parseInt(shortcut.key.replace('openShell', ''), 10) - 1;
            if(index < shells.length) {
              this.addNewTab(activePaneKey, TabType.Terminal, shells[index]);
            }
            break;
        }
      })
    );*/
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  onCloseTab(): Observable<string> {
    return this._closeTab.asObservable();
  }

  onFocusTab(): Observable<string> {
    return this._focusTab.asObservable();
  }

  onGridChanged(): Observable<number> {
    return this._gridChanged.asObservable();
  }

  focusActiveTab(): void {
    const activeTabId = this.store.get(s => s.activeTabId);
    if(activeTabId === undefined) return;
    this._focusTab.next(activeTabId);
  }

  getCountPanes(): number {
    return this.store.get(s => s.tree.length);
  }

  getCountTabs(paneId: string): number {
    const treeNode = this.findPaneNodeByTabId(paneId);
    return treeNode?.data.tabs?.length || 0;
  }

  focusTab(id: string) {
    this.updateActiveTab(id);
  }

  updatePaneRatio(paneId: string, ratio: number) {
    const tree = this.store.get(state => state.tree);
    const pane = tree?.getData(paneId);
    if (pane) {
      pane.ratio = ratio;
    }
    this.updateTree(tree);
  }

  selectPane(paneId: string): Observable<Pane> {
    return this.store.select(s => s.tree.getData(paneId));
  }

  getTabsOnPane(paneId: string): Tab[] {
    return this.store.get(s => s.tree.getData(paneId))?.tabs || [];
  }

  selectActiveTabId(): Observable<string | undefined> {
    return this.store.select(s => s.activeTabId);
  }

  addNewTabOnActivePane(tabType: 'terminal', config: ShellConfig): void;
  addNewTabOnActivePane(tabType: 'settings', config: SettingsTabConfig): void;
  addNewTabOnActivePane(tabType: 'about', config?: undefined): void;
  addNewTabOnActivePane(tabType: 'release-notes', config?: undefined): void;
  addNewTabOnActivePane(tabType: TabType, config?: ShellConfig | SettingsTabConfig): void {
    const activeTabId = this.store.get(s => s.activeTabId);
    if(activeTabId === undefined) return;
    const activeTab = this.findTab(activeTabId);
    const activePaneKey = activeTabId ? this.findPaneNodeByTabId(activeTabId).key : BinaryTree.ROOT_KEY;
    const newTab = this.tabFactory.createTab(tabType, config, activeTab);
    this.addTab(activePaneKey, newTab);
  }

  addNewTab(paneId: string, tabType: 'terminal', config: ShellConfig): void;
  addNewTab(paneId: string, tabType: 'settings', config?: undefined): void;
  addNewTab(paneId: string, tabType: 'about', config?: undefined): void;
  addNewTab(paneId: string, tabType: 'release-notes', config?: undefined): void;
  addNewTab(paneId: string, tabType: TabType, shellConfig?: ShellConfig): void {
    const activeTabId = this.store.get(s => s.activeTabId);
    if(activeTabId === undefined) return;
    const activeTab = this.findTab(activeTabId);
    const newTab = this.tabFactory.createTab(tabType, shellConfig, activeTab);
    this.addTab(paneId, newTab);
  }

  addTab(paneId: string, tab: Tab) {
    const allTabs = [...this.store.get(s => s.tabs)];
    if(!allTabs.find(s => s.id === tab.id)) {
      allTabs.push(tab);
    }
    const tree = this.store.get(s => s.tree);
    const pane = tree.getData(paneId);
    const tabs = [...pane.tabs];
    tabs.forEach(t => t.isSelected = false);
    tabs.push(tab);
    pane.tabs = tabs;
    tree.setData(paneId, pane);
    this.store.update({tree, activeTabId: tab.id, tabs: allTabs});
    this.fireResize();
  }

  fireGridChanged() {
    this._gridChanged.next(Date.now());
  }

  closeTabs(...tabIds: string[]) {
    for (const tabId of tabIds) {
      const tab = this.findTab(tabId);
      if(!tab) continue;
      tab.isClosing = true;
      this._closeTab.next(tab.id);
      this.removeTab(tab.id);
    }
  }

  removeTab(tabId: string, shouldDeleteTab = true): Tab | undefined {
    if(!tabId) {return;}
    const state = this.store.get(s => s);
    let treeNode = this.tryFindPaneNodeByTabId(tabId);
    if (!treeNode) {return;}
    const pane = {...treeNode.data};
    const indexOf = pane.tabs.findIndex(t => t.id === tabId);
    let tabs = [...pane.tabs];
    const removedTab = tabs.splice(indexOf, 1)[0];
    if (tabs.length === 0 && treeNode.key !== BinaryTree.ROOT_KEY) {
      state.tree.remove(treeNode.key);
      treeNode = state.tree.first(t => t.data?.tabs?.length > 0);
      tabs = treeNode.data.tabs;
    }
    tabs.forEach(t => t.isSelected = false);
    const activeTab = this.getNextActiveTabIfTabIsRemoved(tabs, state.activeTabId);
    if (activeTab) {
      activeTab.isSelected = true;
    }
    pane.tabs = tabs;
    state.tree.setData(treeNode.key, pane);
    this.store.update({activeTabId: activeTab?.id});

    if(shouldDeleteTab && removedTab){
      let allTabs = this.store.get(s => s.tabs);
      const indexOfTab = allTabs.findIndex(t => t.id === removedTab.id);
      allTabs = [...allTabs];
      allTabs.splice(indexOfTab, 1);
      this.store.update({tabs: allTabs});
    }

    this.updateTree(state.tree);
    return removedTab;
  }

  updateTabIsReady(tabId: string): void {
    const tab = this.findTab(tabId);
    if(!tab) return;
    const newTab = {...tab, isLoading: false, hasError: false};
    this.updateTab(newTab);
  }

  updateTabHasError(tabId: string) {
    const tab = this.findTab(tabId);
    if(!tab) return;
    const newTab = {...tab, isLoading: false, hasError: true};
    this.updateTab(newTab);
  }

  updateActiveTab(tabId: string): void {
    this._setActiveTab(this.findTab(tabId));
  }

  private _setActiveTab(tab?: Tab): void {
    if(!tab) return;
    const newPaneNode = this.findPaneNodeByTabId(tab.id);
    newPaneNode.data.tabs.forEach(tab => tab.isSelected = false);
    tab.isSelected = true;
    this.updateTab(tab);
    this.store.update({activeTabId: tab.id});
    this.fireResize();
  }

  getTab(id: string): Tab | undefined {
    return this.findTab(id);
  }

  updateTabName(id: string, data: {directory?: string[], command?: string}) {
    const tab = this.findTerminalTab(id);
    if(!tab) return;
    const gridChanged = !arraysEqual(tab?.directory || [], data.directory || []);
    let tabName = TabnameBuilder.create(data, tab);
    tab.directory = data.directory || [];
    tab.name = tabName.name;
    tab.subName = tabName.subName;
    tab.path = tabName.path;
    this.updateTab(tab);
    if(gridChanged) {
      this.fireGridChanged();
    }
  }

  private findTab(tabId: string): Tab | undefined {
    if(!tabId) return;
    const pane = this.findPaneNodeByTabId(tabId);
    return pane.data.tabs.find(t => t.id === tabId);
  }

  private findTerminalTab(tabId: string): TerminalTab | undefined {
    const tab = this.findTab(tabId);
    if(tab?.tabType === 'terminal') {
      return tab as TerminalTab;
    }
    return undefined;
  }

  private findPaneNodeByTabId(tabId: string): BinaryNode<Pane> {
    if (!tabId) {
      throw new Error(`Could not find pane for tab with id ${tabId}`);
    }
    return this.store.get(s => {
      const treeNode = s.tree.first(treeNode => !!treeNode.data?.tabs.find(t => t.id === tabId));
      if (!treeNode) {
        throw new Error(`Could not find pane for tab with id ${tabId}`);
      }
      return treeNode;
    });
  }

  private tryFindPaneNodeByTabId(tabId: string): BinaryNode<Pane> | undefined {
    if (!tabId) {
      return undefined;
    }
    return this.store.get(s => {
      return s.tree.first(treeNode => !!treeNode.data?.tabs.find(t => t.id === tabId));
    });
  }

  private findPaneNodeByPaneId(paneId: string): BinaryNode<Pane> {
    return this.store.get(s => {
      const treeNode = s.tree.first(treeNode => treeNode.key === paneId);
      if (!treeNode) {
        throw new Error(`Could not find pane with id ${paneId}`);
      }
      return treeNode;
    });
  }

  private getNextActiveTabIfTabIsRemoved(currentTabs: Tab[], activeTabId?: string): Tab {
    const nextActiveTab = currentTabs.find(t => t.id === activeTabId);
    if (!nextActiveTab) {
      return currentTabs[currentTabs.length - 1];
    }
    return nextActiveTab;
  }

  private updateTab(tab: Tab): void {
    const treeNode = this.findPaneNodeByTabId(tab.id);
    const tree = this.store.get(s => s.tree);
    const pane = tree.getData(treeNode.key);
    const newTabs = [...pane.tabs];
    const indexOfTab = pane.tabs.findIndex((t) => t.id === tab.id);
    newTabs.splice(indexOfTab, 1, tab);
    pane.tabs = newTabs;
    this.updateTree(tree);
  }

  updateIsCommandRunning(id: string, isRunning: boolean): void {
    const tab = this.findTab(id);
    if(!tab) return;
    tab.isCommandRunning = isRunning;
    this.updateTab(tab);
  }

  updateIsAppRunning(id: string, isRunning: boolean): void {
    const tab = this.findTab(id);
    if(!tab) return;
    tab.isAppRunning = isRunning;
    tab.isCommandRunning = isRunning;
    this.updateTab(tab);
  }

  private splitPane(paneNode: BinaryNode<Pane>, direction: SplitDirection): string {
    const paneParent = new Pane();
    paneParent.splitDirection = direction;
    const paneChild = new Pane();
    const tree = this.store.get(s => s.tree);
    const newKey = tree.add(paneNode.key, 'r', paneParent, paneChild);
    this.updateTree(tree);
    return newKey;
  }

  splitPaneWithNewTab(tabId: string, direction: SplitDirection): void {
    if(!tabId) {return;}
    const paneNode = this.findPaneNodeByTabId(tabId);
    const newPaneId = this.splitPane(paneNode, direction);
    this.addNewTab(newPaneId, 'terminal');
  }

  splitPaneAndMoveTab(tabId: string, direction: SplitDirection): void {
    if(!tabId) {return;}
    const paneNode = this.findPaneNodeByTabId(tabId);
    if (paneNode.data.tabs.length === 1) {
      return;
    }
    const newPaneId = this.splitPane(paneNode, direction);
    const tab = this.removeTab(tabId, false);
    this.addTab(newPaneId, tab);
  }

  unsplit(): void {
    const tree = this.store.get(s => s.tree);
    tree.flatten((t1: Pane, t2: Pane) => {
      const newTabs = [...t1.tabs, ...t2.tabs];
      return {...t1, tabs: newTabs};
    });
    const activeTabId = this.store.get(s => s.activeTabId);
    tree.root.data.tabs.forEach(tab => tab.isSelected = tab.id === activeTabId);
    this.updateTree(tree);
  }

  fireResize() {
    setTimeout(() => this.windowService.resize());
  }

  swap(tabId: string): void {
    const tree = this.store.get(s => s.tree);
    const treeNode = tree.first(n => !!n.data?.tabs.find(t => t.id === tabId));
    treeNode.parent.toggle();
    this.updateTree(tree);
  }

  updateTree(tree: BinaryTree<Pane>) {
    this.setPanePositionFlags(tree);
    const allTabs = [].concat(...tree.getDataOfLeafs().map(leaf => leaf.tabs));
    this.store.update({tabs: allTabs});
    this.store.update({tree});
    this.fireResize();
  }

  private setPanePositionFlags(tree: BinaryTree<Pane>) {
    const currentFirstPane = tree.first((node) => node.data?.isFirstPane);
    if(currentFirstPane) currentFirstPane.data.isFirstPane = false;
    const currentTopRightPane = tree.first((node) => node.data?.isTopRightPane);
    if(currentTopRightPane) currentTopRightPane.data.isTopRightPane = false;
    this.setFirstFlag(tree.root);
    this.setTopRightFlag(tree.root);
  }

  private setFirstFlag(node: BinaryNode<Pane>) {
    if (node.isLeaf) {
      node.data.isFirstPane = true;
      return;
    }

    return this.setFirstFlag(node.left);
  }

  private setTopRightFlag(node: BinaryNode<Pane>) {
    if (node.isLeaf) {
      node.data.isTopRightPane = true;
      return;
    }
    switch (node.data.splitDirection) {
      case SplitDirection.Horizontal:
        node.right.data.isTopRightPane = false;
        return this.setTopRightFlag(node.left);
      case SplitDirection.Vertical:
        node.left.data.isTopRightPane = false;
        return this.setTopRightFlag(node.right);
    }
  }

  updateTabToDrag(tabId: string) {
    this.store.update({tabIdToDrag: tabId});
  }

  updateDropTabIdByPane(paneId: string) {
    const pane = this.findPaneNodeByPaneId(paneId);
    this.updateDropTabId(pane.data.tabs[pane.data.tabs.length -1]?.id, false);
  }

  updateDropTabId(dropTabId: string, shouldReplaceTab: boolean = true) {
    const dragTabId = this.store.get(s => s.tabIdToDrag);
    if (dropTabId === dragTabId) {
      this.store.update({tabIdToDrag: null});
      return;
    }
    const fromPane = this.findPaneNodeByTabId(dragTabId);
    const toPane = this.findPaneNodeByTabId(dropTabId);
    let fromTabs: Tab[];
    let toTabs: Tab[];
    if (fromPane.key === toPane.key) {
      fromTabs = [...fromPane.data.tabs];
      toTabs = fromTabs;
    } else {
      fromTabs = [...fromPane.data.tabs];
      toTabs = [...toPane.data.tabs];
    }
    const dragTab = fromTabs.find(t => t.id === dragTabId);
    const indexOfDragTab = fromTabs.indexOf(dragTab);
    const dropTab = toTabs.find(t => t.id === dropTabId);
    let indexOfDropTab = toTabs.indexOf(dropTab);
    indexOfDropTab = indexOfDropTab === -1 ? toTabs.length : indexOfDropTab;
    indexOfDropTab = shouldReplaceTab ? indexOfDropTab : indexOfDropTab + 1;
    fromTabs.splice(indexOfDragTab, 1);
    toTabs.splice(indexOfDropTab, 0, dragTab);
    this.fixVisibilityOfTabs(fromTabs, dragTab);
    this.fixVisibilityOfTabs(toTabs, dragTab);
    fromPane.data.tabs = fromTabs;
    toPane.data.tabs = toTabs;
    const state = this.store.get(s => s);
    if (fromTabs.length === 0) {
      state.tree.remove(fromPane.key);
    }
    this.store.update({tabIdToDrag: null});
    this.updateTree(state.tree);
  }

  private fixVisibilityOfTabs(tabs: Tab[], tabToDrop: Tab) {
    if (tabs.length === 0) {
      return;
    }
    const activeTabId = this.store.get(s => s.activeTabId);
    const activeTabInList = tabs.find(t => t.id === activeTabId);
    const dropT = tabs.find(t => t.id === tabToDrop.id);
    tabs.forEach(t => t.isSelected = false);
    if (activeTabInList) {
      activeTabInList.isSelected = true;
    } else if (dropT) {
      dropT.isSelected = true;
    } else {
      tabs[tabs.length - 1].isSelected = true;
    }
  }

  closeOtherTabs(tabId: string): void {
    if(!tabId) {return;}
    const tree = this.store.get(s => s.tree);
    const treeNode = tree.first(n => !!n.data?.tabs.find(t => t.id === tabId));
    const tabsToClose = treeNode.data.tabs.filter(tab => tab.id !== tabId).map(tab => tab.id);
    this.closeTabs(...tabsToClose);
  }

  duplicateTab(tabId: string): void {
    const tree = this.store.get(s => s.tree);
    const treeNode = tree.first(n => !!n.data?.tabs.find(t => t.id === tabId));
    const tab = treeNode.data.tabs.find(tab => tab.id === tabId);
    let config: ShellConfig = null;
    if (tab.tabType === TabType.Terminal) {
      config = {...(tab as TerminalTab).config};
      config.workingDir = Path.toOsPath((tab as TerminalTab).directory);
    }
    this.addNewTab(treeNode.key, tab.tabType, config);
  }

  closeAllTabs(): void {
    const tree = this.store.get(s => s.tree);
    const tabsToClose = [].concat(...tree.getDataOfLeafs().map(t => t.tabs.map(tab => tab.id)));
    this.closeTabs(...tabsToClose);
  }

  isActiveTab(id: string) {
    return this.store.get(s => s.activeTabId) === id;
  }

  getIsAnyTabBusy(): boolean {
    return !!this.store.get(s => s.tree).first(n => !!n.data.tabs.find(t => t.isCommandRunning));
  }

  selectTree(): Observable<BinaryTree<Pane>> {
    return this.store.select(s => s.tree);
  }

  getTree(): BinaryTree<Pane> {
    return this.store.get(s => s.tree);
  }

  private switchToNextTab(activePaneKey: string, activeTabId: string) {
    if(!activeTabId) {return;}
    const tree = this.store.get(s => s.tree);
    const pane = tree.getData(activePaneKey);
    const indexOfActiveTab = pane.tabs.findIndex(s => s.id === activeTabId);
    if (indexOfActiveTab === pane.tabs.length - 1) {
      const nextPane = tree.getNextLeaf(activePaneKey);
      this._setActiveTab(nextPane.data.tabs[0]);
    } else {
      this._setActiveTab(pane.tabs[indexOfActiveTab + 1]);
    }
  }

  private switchToPreviousTab(activePaneKey: string, activeTabId: string) {
    if(!activeTabId) {return;}
    const tree = this.store.get(s => s.tree);
    const pane = tree.getData(activePaneKey);
    const indexOfActiveTab = pane.tabs.findIndex(s => s.id === activeTabId);
    if (indexOfActiveTab === 0) {
      const previousPane = tree.getPreviousLeaf(activePaneKey);
      this._setActiveTab(previousPane.data.tabs[previousPane.data.tabs.length - 1]);
    } else {
      this._setActiveTab(pane.tabs[indexOfActiveTab - 1]);
    }
  }

  getActiveTabId() {
    return this.store.get(s => s.activeTabId);
  }

  restoreTree(tree: BinaryTree<Pane>) {
    this.closeAllTabs();
    const paneWithSelectedTab = tree.find((node) => node.isLeaf);
    this.updateTree(tree);
    this._setActiveTab(paneWithSelectedTab[0].data.tabs[0]);
  }

  isDragging(): Observable<boolean> {
    return this.store.select(s => !!s.tabIdToDrag);
  }

  resetTree() {
    this.closeAllTabs();
    const tree = new BinaryTree(new Pane());
    this.updateTree(tree);
    this.addNewTab(BinaryTree.ROOT_KEY, TabType.Terminal);
  }

  removeErrorFlagOnTab(tabId: string) {
    const tab = this.findTab(tabId);
    if(!tab) return;
    tab.hasError = false;
    this.updateTab(tab);
  }

  selectAllTabs(): Observable<Tab[]> {
    return this.store.select(s => s.tabs);
  }

  clearTabConfig(id: string) {
    const tab = this.findTab(id);
    if(!tab) return;
    if('config' in tab) {
      tab.config = undefined;
      this.updateTab(tab);
    }
  }
}
