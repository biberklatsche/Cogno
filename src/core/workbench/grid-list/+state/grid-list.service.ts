import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { FocusActiveTerminalAction } from "@cogno/core/workbench/bus/grid-list/actions";
import {
  TabAddedEvent,
  TabRemovedEvent,
  TabSelectedEvent,
} from "@cogno/core/workbench/bus/tab-list/events";
import { SessionHostFactory } from "@cogno/core/workbench/grid-list/+state/session-host-factory";
import { TerminalSessionRegistry } from "@cogno/core/workbench/terminal/+state/terminal-session.registry";
import {
  BinaryNode,
  BinaryTree,
  defaultWorkspaceIdContract,
  GridConfig,
  PaneConfig,
  TabId,
  TerminalId,
} from "@cogno/shared/domain";
import { IdCreator } from "@cogno/shared/support";
import { BehaviorSubject, combineLatest, map, Observable } from "rxjs";
import { Grid, GridList, Pane, SplitDirection } from "../+model/model";

@Injectable({ providedIn: "root" })
export class GridListService {
  private _gridList: BehaviorSubject<GridList> = new BehaviorSubject<GridList>({});
  private _maximizedTerminalId: BehaviorSubject<TerminalId | undefined> = new BehaviorSubject<
    TerminalId | undefined
  >(undefined);
  private paneSwapDragSourceTerminalId: TerminalId | undefined;
  private paneSwapDragTargetTerminalId: TerminalId | undefined;
  private readonly gridListByWorkspaceIdentifier = new Map<string, GridList>();
  private readonly activeTabIdByWorkspaceIdentifier = new Map<string, TabId | undefined>();
  private readonly maximizedTerminalIdByWorkspaceIdentifier = new Map<
    string,
    TerminalId | undefined
  >();
  private activeWorkspaceIdentifier: string | undefined = defaultWorkspaceIdContract;
  get grids$(): Observable<Grid[]> {
    return this._gridList.pipe(map((g) => Object.values(g)));
  }
  private _activeTabId: BehaviorSubject<TabId | undefined> = new BehaviorSubject<TabId | undefined>(
    undefined,
  );
  get activeTabId$(): Observable<TabId | undefined> {
    return this._activeTabId.asObservable();
  }
  get maximizedTerminalId$(): Observable<TerminalId | undefined> {
    return this._maximizedTerminalId.asObservable();
  }

  activateWorkspace(workspaceIdentifier: string): void {
    this.activeWorkspaceIdentifier = workspaceIdentifier;
    if (!this.gridListByWorkspaceIdentifier.has(workspaceIdentifier)) {
      this.gridListByWorkspaceIdentifier.set(workspaceIdentifier, {});
    }
    this.syncActiveWorkspaceState();
  }

  /** Every terminal id laid out in a workspace's grids (session restore, step 27). */
  terminalIdsForWorkspace(workspaceIdentifier: string): TerminalId[] {
    const gridList = this.gridListByWorkspaceIdentifier.get(workspaceIdentifier);
    if (!gridList) {
      return [];
    }
    const terminalIds: TerminalId[] = [];
    for (const grid of Object.values(gridList)) {
      for (const node of grid.tree.find((candidate) => candidate.isLeaf)) {
        const terminalId = node.data?.terminalId;
        if (terminalId !== undefined) {
          terminalIds.push(terminalId);
        }
      }
    }
    return terminalIds;
  }

  findWorkspaceIdentifierByTerminalId(terminalId: TerminalId): string | undefined {
    for (const [workspaceIdentifier, gridList] of this.gridListByWorkspaceIdentifier.entries()) {
      const terminalExistsInWorkspace = Object.values(gridList).some((grid) =>
        grid.tree.first((node) => node.isLeaf && node.data?.terminalId === terminalId),
      );
      if (terminalExistsInWorkspace) {
        return workspaceIdentifier;
      }
    }

    return undefined;
  }

  findTabIdByTerminalId(terminalId: TerminalId): TabId | undefined {
    for (const gridList of this.gridListByWorkspaceIdentifier.values()) {
      const tabId = this.determineTabId(gridList, terminalId);
      if (tabId) {
        return tabId;
      }
    }

    return undefined;
  }

  moveActiveWorkspaceRuntime(targetWorkspaceIdentifier: string): void {
    const sourceWorkspaceIdentifier = this.activeWorkspaceIdentifier;
    if (!sourceWorkspaceIdentifier || sourceWorkspaceIdentifier === targetWorkspaceIdentifier) {
      this.activateWorkspace(targetWorkspaceIdentifier);
      return;
    }

    const gridList = this.gridListByWorkspaceIdentifier.get(sourceWorkspaceIdentifier) ?? {};
    const activeTabIdentifier =
      this.activeTabIdByWorkspaceIdentifier.get(sourceWorkspaceIdentifier);
    const maximizedTerminalIdentifier =
      this.maximizedTerminalIdByWorkspaceIdentifier.get(sourceWorkspaceIdentifier);

    this.gridListByWorkspaceIdentifier.set(targetWorkspaceIdentifier, gridList);
    this.activeTabIdByWorkspaceIdentifier.set(targetWorkspaceIdentifier, activeTabIdentifier);
    this.maximizedTerminalIdByWorkspaceIdentifier.set(
      targetWorkspaceIdentifier,
      maximizedTerminalIdentifier,
    );

    this.gridListByWorkspaceIdentifier.delete(sourceWorkspaceIdentifier);
    this.activeTabIdByWorkspaceIdentifier.delete(sourceWorkspaceIdentifier);
    this.maximizedTerminalIdByWorkspaceIdentifier.delete(sourceWorkspaceIdentifier);

    this.activeWorkspaceIdentifier = targetWorkspaceIdentifier;
    this.syncActiveWorkspaceState();
  }

  removeWorkspaceRuntime(workspaceIdentifier: string): void {
    this.destroyWorkspaceGridList(this.gridListByWorkspaceIdentifier.get(workspaceIdentifier));
    this.gridListByWorkspaceIdentifier.delete(workspaceIdentifier);
    this.activeTabIdByWorkspaceIdentifier.delete(workspaceIdentifier);
    this.maximizedTerminalIdByWorkspaceIdentifier.delete(workspaceIdentifier);
    if (this.activeWorkspaceIdentifier === workspaceIdentifier) {
      this.activeWorkspaceIdentifier = undefined;
      this._gridList.next({});
      this._activeTabId.next(undefined);
      this._maximizedTerminalId.next(undefined);
    }
  }

  get activeGridIsSplit$(): Observable<boolean> {
    return this._gridList.pipe(
      map((gridList) => {
        if (!this._activeTabId.value) return false;
        const grid = gridList[this._activeTabId.value];
        return grid ? !grid.tree.root.isLeaf : false;
      }),
    );
  }

  constructor(
    private bus: AppBus,
    private componentFactory: SessionHostFactory,
    private readonly sessionRegistry: TerminalSessionRegistry,
    destroyRef: DestroyRef,
  ) {
    combineLatest([this._gridList, this._activeTabId])
      .pipe(
        map(([gridList, activeTabId]) => {
          const grid = activeTabId ? gridList[activeTabId] : undefined;
          if (!grid) return [];
          return grid.tree
            .find((node) => node.isLeaf)
            .map((node) => node.data?.terminalId)
            .filter((terminalId): terminalId is TerminalId => terminalId !== undefined);
        }),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe((terminalIds) => {
        this.bus.publish({
          type: "VisibleTerminalsChanged",
          payload: { terminalIds },
        });
      });

    this.bus
      .on$("TabRemoved")
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event: TabRemovedEvent) => {
        this.removeGrid(event.payload);
      });

    this.bus
      .on$("TabAdded")
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event: TabAddedEvent) => {
        const payload = event.payload;
        if (!payload) return;
        this.restoreGrid({
          tabId: payload.tabId,
          pane: { workingDir: payload.workingDir, shellName: payload.shellName },
        });
        if (payload.isActive) {
          this.selectGrid(payload.tabId);
        }
      });

    this.bus
      .on$("TabSelected")
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event: TabSelectedEvent) => {
        this.selectGrid(event.payload);
      });

    // Title and cwd come straight from the session's facts now, tagged with
    // the terminal id by the registry.
    this.sessionRegistry.facts$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(({ terminalId, fact }) => {
        if (fact.type === "titleChanged") {
          this.applyPaneTitle(terminalId, fact.title);
        } else if (fact.type === "cwdReported") {
          this.applyPaneCwd(terminalId, fact.cwd);
        } else if (fact.type === "exited") {
          // The shell ended: drop its pane (and the tab/session with the last
          // one). No bus hop - the session reports, the workbench acts.
          this.removePane(terminalId);
        }
      });
    this.bus
      .on$("FocusActiveTerminal")
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((_event: FocusActiveTerminalAction) => {
        const focusedTerminalId = this.getFocusedTerminalId();
        if (!focusedTerminalId) return;
        this.bus.publish({
          type: "FocusTerminal",
          payload: focusedTerminalId,
        });
      });

    // Focus is a session fact now; kept in its own subscription so its
    // invariant check can't disturb the title/cwd/exited stream.
    this.sessionRegistry.facts$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(({ terminalId, fact }) => {
        if (fact.type === "focusChanged" && fact.focused) {
          this.applyPaneFocus(terminalId);
        }
      });
  }

  removePane(terminalId: TerminalId) {
    const gridList = this.getActiveWorkspaceGridList();
    const gridAndNode = this.determineGrid(gridList, terminalId);
    if (!gridAndNode) return;
    if (this._maximizedTerminalId.value === terminalId) {
      this.minimizePane();
    }
    if (gridAndNode.node.isRoot) {
      this.bus.publish({
        type: "RemoveTab",
        payload: gridAndNode.grid.tabId,
      });
    } else {
      const wasFocusedNode = gridAndNode.node.data?.isFocused;
      const newChild = gridAndNode.grid.tree.remove(gridAndNode.node.key);
      if (wasFocusedNode) {
        this.deferFocusTo(newChild?.data?.terminalId);
      }
    }
    this.componentFactory.destroy(terminalId);
    this.setActiveWorkspaceGridList(gridList);
  }

  startPaneSwapDrag(sourceTerminalId: TerminalId): void {
    this.paneSwapDragSourceTerminalId = sourceTerminalId;
    this.paneSwapDragTargetTerminalId = sourceTerminalId;
  }

  updatePaneSwapTarget(targetTerminalId: TerminalId): void {
    if (!this.paneSwapDragSourceTerminalId) return;
    this.paneSwapDragTargetTerminalId = targetTerminalId;
  }

  finishPaneSwapDrag(): void {
    if (!this.paneSwapDragSourceTerminalId || !this.paneSwapDragTargetTerminalId) {
      this.cancelPaneSwapDrag();
      return;
    }
    this.swapPanes(this.paneSwapDragSourceTerminalId, this.paneSwapDragTargetTerminalId);
    this.cancelPaneSwapDrag();
  }

  cancelPaneSwapDrag(): void {
    this.paneSwapDragSourceTerminalId = undefined;
    this.paneSwapDragTargetTerminalId = undefined;
  }

  isPaneSwapDragActive(): boolean {
    return this.paneSwapDragSourceTerminalId !== undefined;
  }

  movePaneSwapSourceToNewTab(): void {
    if (!this.paneSwapDragSourceTerminalId) {
      this.cancelPaneSwapDrag();
      return;
    }

    const sourceTerminalId = this.paneSwapDragSourceTerminalId;
    const gridList = this.getActiveWorkspaceGridList();
    if (this._maximizedTerminalId.value === sourceTerminalId) {
      this.minimizePane();
    }
    const sourceGridAndNode = this.determineGrid(gridList, sourceTerminalId);
    if (!sourceGridAndNode || sourceGridAndNode.node.isRoot || !sourceGridAndNode.node.data) {
      this.cancelPaneSwapDrag();
      return;
    }

    const sourcePaneData: Pane = { ...sourceGridAndNode.node.data, isFocused: true };
    const promotedNode = sourceGridAndNode.grid.tree.remove(sourceGridAndNode.node.key);
    if (promotedNode?.data) {
      promotedNode.data = { ...promotedNode.data, isFocused: false };
    }

    const newTabId = IdCreator.newTabId();
    const movedPaneRootNode = new BinaryNode<Pane>({ ...sourcePaneData });
    gridList[newTabId] = { tabId: newTabId, tree: new BinaryTree<Pane>(movedPaneRootNode) };
    this.setActiveWorkspaceGridList(gridList);

    this.bus.publish({
      type: "CreateTab",
      payload: {
        tabId: newTabId,
        systemTitle: this.resolvePaneTitle(sourcePaneData),
        isActive: true,
      },
    });

    this.cancelPaneSwapDrag();
  }

  swapPanes(sourceTerminalId: TerminalId, targetTerminalId: TerminalId): void {
    if (sourceTerminalId === targetTerminalId) return;
    const gridList = this.getActiveWorkspaceGridList();
    const sourceGridAndNode = this.determineGrid(gridList, sourceTerminalId);
    const targetGridAndNode = this.determineGrid(gridList, targetTerminalId);
    if (!sourceGridAndNode || !targetGridAndNode) return;
    if (sourceGridAndNode.grid.tabId !== targetGridAndNode.grid.tabId) return;

    const sourcePane = sourceGridAndNode.node.data;
    const targetPane = targetGridAndNode.node.data;
    if (!sourcePane || !targetPane) return;

    sourceGridAndNode.node.data = targetPane;
    targetGridAndNode.node.data = sourcePane;
    this.setActiveWorkspaceGridList(gridList);
  }

  split(terminalId: TerminalId, splitDirection: SplitDirection, side: "l" | "r") {
    if (!this._activeTabId.value) throw new Error("No active tab id found.");
    const gridList = this.getActiveWorkspaceGridList();
    const tree = gridList[this._activeTabId.value].tree;
    const node = tree.first((s) => s.isLeaf && s.data?.terminalId === terminalId);
    if (!node) throw new Error("No focused pane found.");
    const terminalIdToBlur = node.data?.terminalId;
    if (!terminalIdToBlur) throw new Error("Focused pane does not contain a terminal id.");
    const paneParent: Pane = {
      splitDirection: splitDirection,
      ratio: 0.5,
    };
    this.bus.publish({
      type: "BlurTerminal",
      payload: terminalIdToBlur,
    });

    const paneChild: Pane = { terminalId: IdCreator.newTerminalId() };
    tree.add(node.key, side, paneParent, paneChild);
    this.setActiveWorkspaceGridList(gridList);
  }

  restoreGrids(gridConfigList: GridConfig[]) {
    this.restoreGridsForWorkspace(gridConfigList, this.getRequiredActiveWorkspaceIdentifier());
  }

  restoreGridsForWorkspace(gridConfigList: GridConfig[], workspaceIdentifier: string): void {
    this.destroyWorkspaceGridList(this.gridListByWorkspaceIdentifier.get(workspaceIdentifier));
    const restoredGridList: GridList = {};
    for (const grid of gridConfigList) {
      restoredGridList[grid.tabId] = { tabId: grid.tabId, tree: this.createTree(grid) };
    }
    this.gridListByWorkspaceIdentifier.set(workspaceIdentifier, restoredGridList);
    this.ensureSessions(restoredGridList);
    if (this.activeWorkspaceIdentifier === workspaceIdentifier) {
      this._gridList.next({ ...restoredGridList });
    }
  }

  /**
   * Every pane in a layout has a running session, on screen or not
   * (ARCHITECTURE.md 2.3): the shell runs, commands are recorded, the title
   * follows. Only the visible panes are attached.
   */
  private ensureSessions(gridList: GridList): void {
    for (const grid of Object.values(gridList)) {
      for (const node of grid.tree.find((node) => node.isLeaf)) {
        if (node.data?.terminalId) this.componentFactory.ensureSession(node.data);
      }
    }
  }

  getGridConfigs(workspaceIdentifier?: string): GridConfig[] {
    const result: GridConfig[] = [];
    const targetWorkspaceIdentifier =
      workspaceIdentifier ?? this.getRequiredActiveWorkspaceIdentifier();
    const gridList = this.gridListByWorkspaceIdentifier.get(targetWorkspaceIdentifier) ?? {};
    for (const grid of Object.values(gridList)) {
      result.push({
        tabId: grid.tabId,
        pane: this.serializeNode(grid.tree.root),
      });
    }
    return result;
  }

  restoreGrid(gridConfig: GridConfig) {
    const gridList = this.getActiveWorkspaceGridList();
    if (gridList[gridConfig.tabId]) return;
    gridList[gridConfig.tabId] = { tabId: gridConfig.tabId, tree: this.createTree(gridConfig) };
    this.setActiveWorkspaceGridList(gridList);
  }

  private createTree(paneConfig: GridConfig): BinaryTree<Pane> {
    const rootNode: BinaryNode<Pane> = new BinaryNode();
    this.addNode(rootNode, paneConfig.pane);
    return new BinaryTree(rootNode);
  }

  private addNode(parent: BinaryNode<Pane>, nodeConfig: PaneConfig) {
    if (nodeConfig.splitDirection) {
      parent.data = { splitDirection: nodeConfig.splitDirection, ratio: nodeConfig.ratio };
      if (!nodeConfig.leftChild || !nodeConfig.rightChild) {
        throw new Error("Invalid split pane configuration");
      }
      const leftChild: BinaryNode<Pane> = new BinaryNode();
      const rightChild: BinaryNode<Pane> = new BinaryNode();
      parent.addToNode(leftChild, "l");
      parent.addToNode(rightChild, "r");
      this.addNode(leftChild, nodeConfig.leftChild);
      this.addNode(rightChild, nodeConfig.rightChild);
    } else {
      parent.data = {
        shellName: nodeConfig.shellName,
        workingDir: nodeConfig.workingDir,
        title: nodeConfig.title,
        // Reuse the persisted terminal id so restored scrollback (keyed by it)
        // matches; only generate one for a fresh pane (step 27).
        terminalId: nodeConfig.terminalId ?? IdCreator.newTerminalId(),
      };
    }
  }

  private serializeNode(node: BinaryNode<Pane>): PaneConfig {
    // Leaf node -> TerminalConfig
    if (node.isLeaf) {
      return {
        shellName: node.data?.shellName,
        workingDir: node.data?.workingDir,
        title: node.data?.title,
        // Persisted so a restored pane keeps its terminal id and its scrollback
        // snapshot (keyed by it) can be replayed (step 27).
        terminalId: node.data?.terminalId,
      };
    }
    // Split node
    const pane = node.data;
    const leftChild = node.left;
    const rightChild = node.right;
    if (!pane?.splitDirection || leftChild === undefined || rightChild === undefined) {
      throw new Error("Invalid split pane node.");
    }
    return {
      splitDirection: pane.splitDirection,
      ratio: pane.ratio,
      leftChild: this.serializeNode(leftChild),
      rightChild: this.serializeNode(rightChild),
    };
  }

  removeGrid(tab?: TabId) {
    if (tab === undefined) return;
    const gridList = this.getActiveWorkspaceGridList();
    const grid = gridList[tab];
    if (!grid) return;
    const terminalIds = grid.tree.find((s) => s.isLeaf).map((s) => s.data?.terminalId);
    delete gridList[tab];
    for (const terminalId of terminalIds) {
      if (!terminalId) continue;
      this.componentFactory.destroy(terminalId);
    }
    this.setActiveWorkspaceGridList(gridList);
    if (this._activeTabId.value === tab) {
      this.setActiveWorkspaceTabIdentifier(undefined);
    }
  }

  selectGrid(tab?: TabId) {
    if (tab === undefined) return;
    const grid = this.getActiveWorkspaceGridList()[tab];
    if (!grid) return;
    this.minimizePane();
    this.setActiveWorkspaceTabIdentifier(tab);
    const focusedNode = grid.tree.first((n) => n.isLeaf && (n.data?.isFocused ?? false));
    const terminalId = focusedNode?.data?.terminalId ?? this.getFirstTerminalId(grid.tree.root);
    this.deferFocusTo(terminalId);
  }

  getFirstTerminalId(node: BinaryNode<Pane>): TerminalId {
    if (node.isLeaf) {
      const terminalId = node.data?.terminalId;
      if (!terminalId) throw new Error("Leaf pane does not contain a terminal id.");
      return terminalId;
    }
    if (!node.left) throw new Error("Split pane does not contain a left child.");
    return this.getFirstTerminalId(node.left);
  }

  private applyPaneFocus(terminalId: TerminalId): void {
    if (!this._activeTabId.value) throw new Error("No active tab id found.");
    const gridList = this.getActiveWorkspaceGridList();
    const focusedTabId = this.determineTabId(gridList, terminalId);
    if (!focusedTabId || focusedTabId !== this._activeTabId.value) return;
    const activeGrid = gridList[this._activeTabId.value];
    const currentFocusedTab = activeGrid.tree.first(
      (s) => (s.isLeaf && s.data?.isFocused) ?? false,
    );
    if (currentFocusedTab?.data) currentFocusedTab.data.isFocused = false;
    const paneConfig = gridList[this._activeTabId.value].tree.first(
      (s) => s.isLeaf && s.data?.terminalId === terminalId,
    )?.data;
    if (!paneConfig) return;
    paneConfig.isFocused = true;
    this.setActiveWorkspaceGridList(gridList);
    this.publishPaneTitleToTab(this._activeTabId.value, paneConfig);
  }

  private applyPaneTitle(terminalId: TerminalId, title: string): void {
    if (!title) return;
    const gridList = this.getActiveWorkspaceGridList();
    const gridAndNode = this.determineGrid(gridList, terminalId);
    if (!gridAndNode?.node.data) return;
    gridAndNode.node.data = { ...gridAndNode.node.data, title };
    this.setActiveWorkspaceGridList(gridList);
    if (gridAndNode.node.data.isFocused) {
      this.publishPaneTitleToTab(gridAndNode.grid.tabId, gridAndNode.node.data);
    }
  }

  private applyPaneCwd(terminalId: TerminalId, cwd: string): void {
    if (!cwd) return;
    const gridList = this.getActiveWorkspaceGridList();
    const tabId = this.determineTabId(gridList, terminalId);
    if (!tabId) return;
    const node = gridList[tabId].tree.first((s) => s.isLeaf && s.data?.terminalId === terminalId);
    if (!node?.data) return;
    node.data = { ...node.data, workingDir: cwd };
    this.setActiveWorkspaceGridList(gridList);
    if (node.data.isFocused && !node.data.title) {
      this.publishPaneTitleToTab(tabId, node.data);
    }
  }

  /** True when the pane of `terminalId` belongs to the tab that is showing. */
  isPaneInActiveTab(terminalId: TerminalId): boolean {
    return !!this.getActiveGrid()?.tree.first(
      (node) => node.isLeaf && node.data?.terminalId === terminalId,
    );
  }

  getFocusedTerminalId(): TerminalId | undefined {
    const activeGrid = this.getActiveGrid();
    if (!activeGrid) return;
    const focusedNode = activeGrid.tree.first((s) => (s.isLeaf && s.data?.isFocused) ?? false);
    if (!focusedNode) return;
    return focusedNode.data?.terminalId;
  }

  focusActiveTerminal(): void {
    this.bus.publish({ type: "FocusActiveTerminal" });
  }

  focusAdjacentPane(terminalId: TerminalId, direction: 1 | -1): void {
    const activeGrid = this.getActiveGrid();
    if (!activeGrid) return;
    const currentLeaf = activeGrid.tree.first(
      (node) => node.isLeaf && node.data?.terminalId === terminalId,
    );
    if (!currentLeaf) return;

    const adjacentLeaf =
      direction === 1
        ? activeGrid.tree.getNextLeaf(currentLeaf.key)
        : activeGrid.tree.getPreviousLeaf(currentLeaf.key);
    const adjacentTerminalId = adjacentLeaf?.data?.terminalId;
    if (!adjacentTerminalId || adjacentTerminalId === terminalId) return;

    this.bus.publish({
      type: "FocusTerminal",
      payload: adjacentTerminalId,
    });
  }

  private maximizePane(terminalId: TerminalId): void {
    this.setActiveWorkspaceMaximizedTerminalIdentifier(terminalId);
    this.bus.publish({ type: "PaneMaximizedChanged", payload: { terminalId } });
  }

  togglePaneMaximize(terminalId: TerminalId): void {
    if (this._maximizedTerminalId.value === terminalId) {
      this.minimizePane();
      return;
    }
    this.maximizePane(terminalId);
  }

  private minimizePane(): void {
    if (!this._maximizedTerminalId.value) return;
    this.setActiveWorkspaceMaximizedTerminalIdentifier(undefined);
    this.bus.publish({ type: "PaneMaximizedChanged", payload: { terminalId: undefined } });
  }

  private getActiveGrid(): Grid | undefined {
    if (!this._activeTabId.value) return;
    return this._gridList.value[this._activeTabId.value];
  }

  private determineGrid(
    gridList: GridList,
    terminalId?: TerminalId,
  ): { grid: Grid; node: BinaryNode<Pane> } | undefined {
    if (!terminalId) return;
    for (const grid of Object.values(gridList)) {
      const node = grid.tree.first((p) => p.data?.terminalId === terminalId);
      if (node?.isLeaf) {
        return { grid, node };
      }
    }
    return;
  }

  private determineTabId(
    gridList: GridList,
    terminalId: TerminalId | undefined,
  ): TabId | undefined {
    if (!terminalId) return;
    for (const grid of Object.values(gridList)) {
      const node = grid.tree.first((p) => p.data?.terminalId === terminalId);
      if (node?.isLeaf) {
        return grid.tabId;
      }
    }
    return;
  }

  private publishPaneTitleToTab(tabId: TabId, pane: Pane): void {
    this.bus.publish({
      type: "ChangeTabTitle",
      payload: { tabId, title: this.resolvePaneTitle(pane) },
    });
  }

  private resolvePaneTitle(pane: Pane): string {
    return pane.title ?? pane.workingDir ?? "Shell";
  }

  private getRequiredActiveWorkspaceIdentifier(): string {
    if (!this.activeWorkspaceIdentifier) {
      throw new Error("No active workspace found for grid list.");
    }
    return this.activeWorkspaceIdentifier;
  }

  private getActiveWorkspaceGridList(): GridList {
    const workspaceIdentifier = this.getRequiredActiveWorkspaceIdentifier();
    const gridList = this.gridListByWorkspaceIdentifier.get(workspaceIdentifier);
    if (gridList) {
      return gridList;
    }
    const emptyGridList: GridList = {};
    this.gridListByWorkspaceIdentifier.set(workspaceIdentifier, emptyGridList);
    return emptyGridList;
  }

  private setActiveWorkspaceGridList(gridList: GridList): void {
    const workspaceIdentifier = this.getRequiredActiveWorkspaceIdentifier();
    this.gridListByWorkspaceIdentifier.set(workspaceIdentifier, gridList);
    this.ensureSessions(gridList);
    this._gridList.next({ ...gridList });
  }

  private setActiveWorkspaceTabIdentifier(tabIdentifier: TabId | undefined): void {
    const workspaceIdentifier = this.getRequiredActiveWorkspaceIdentifier();
    this.activeTabIdByWorkspaceIdentifier.set(workspaceIdentifier, tabIdentifier);
    this._activeTabId.next(tabIdentifier);
  }

  private setActiveWorkspaceMaximizedTerminalIdentifier(terminalId: TerminalId | undefined): void {
    const workspaceIdentifier = this.getRequiredActiveWorkspaceIdentifier();
    this.maximizedTerminalIdByWorkspaceIdentifier.set(workspaceIdentifier, terminalId);
    this._maximizedTerminalId.next(terminalId);
  }

  private syncActiveWorkspaceState(): void {
    if (!this.activeWorkspaceIdentifier) {
      this._gridList.next({});
      this._activeTabId.next(undefined);
      this._maximizedTerminalId.next(undefined);
      return;
    }

    const activeGridList =
      this.gridListByWorkspaceIdentifier.get(this.activeWorkspaceIdentifier) ?? {};
    this._gridList.next({ ...activeGridList });
    this._activeTabId.next(
      this.activeTabIdByWorkspaceIdentifier.get(this.activeWorkspaceIdentifier),
    );
    this._maximizedTerminalId.next(
      this.maximizedTerminalIdByWorkspaceIdentifier.get(this.activeWorkspaceIdentifier),
    );
  }

  private destroyWorkspaceGridList(gridList: GridList | undefined): void {
    if (!gridList) return;
    for (const grid of Object.values(gridList)) {
      const terminalIds = grid.tree
        .find((node) => node.isLeaf)
        .map((node) => node.data?.terminalId);
      for (const terminalId of terminalIds) {
        if (!terminalId) continue;
        this.componentFactory.destroy(terminalId);
      }
    }
  }

  deferFocusTo(terminalId: TerminalId | undefined): void {
    if (!terminalId) {
      return;
    }

    const scheduleFocus =
      globalThis.requestAnimationFrame ??
      ((callback: FrameRequestCallback) => queueMicrotask(() => callback(0)));

    // Focus after the current UI update has committed instead of relying on a fixed delay.
    scheduleFocus(() => {
      this.bus.publish({ type: "FocusTerminal", payload: terminalId });
    });
  }
}
