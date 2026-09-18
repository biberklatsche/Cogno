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
import { BehaviorSubject, distinctUntilChanged, map, Observable } from "rxjs";
import { Grid, GridList, Pane, SplitDirection } from "../+model/model";

/** What one workspace owns here. It is activated, moved and removed as one. */
type WorkspaceGrids = {
  grids: GridList;
  activeTabId?: TabId;
  maximizedTerminalId?: TerminalId;
};

/** Where a terminal's pane sits. */
type PaneLocation = {
  workspaceIdentifier: string;
  tabId: TabId;
  grid: Grid;
  node: BinaryNode<Pane>;
};

@Injectable({ providedIn: "root" })
export class GridListService {
  private readonly stateByWorkspaceIdentifier = new Map<string, WorkspaceGrids>();
  /**
   * The active workspace's state. `grids` is a fresh copy on every grid write
   * and the same object otherwise, which is what `grids$` tells writes apart by.
   */
  private readonly state$ = new BehaviorSubject<WorkspaceGrids>({ grids: {} });
  private paneSwapDragSourceTerminalId: TerminalId | undefined;
  private paneSwapDragTargetTerminalId: TerminalId | undefined;
  private activeWorkspaceIdentifier: string | undefined = defaultWorkspaceIdContract;
  get grids$(): Observable<Grid[]> {
    return this.state$.pipe(
      map((state) => state.grids),
      distinctUntilChanged(),
      map((grids) => Object.values(grids)),
    );
  }
  get activeTabId$(): Observable<TabId | undefined> {
    return this.state$.pipe(
      map((state) => state.activeTabId),
      distinctUntilChanged(),
    );
  }
  get maximizedTerminalId$(): Observable<TerminalId | undefined> {
    return this.state$.pipe(
      map((state) => state.maximizedTerminalId),
      distinctUntilChanged(),
    );
  }

  activateWorkspace(workspaceIdentifier: string): void {
    this.activeWorkspaceIdentifier = workspaceIdentifier;
    if (!this.stateByWorkspaceIdentifier.has(workspaceIdentifier)) {
      this.stateByWorkspaceIdentifier.set(workspaceIdentifier, { grids: {} });
    }
    this.syncActiveWorkspaceState();
  }

  /** Every terminal id laid out in a workspace's grids (session restore, step 27). */
  terminalIdsForWorkspace(workspaceIdentifier: string): TerminalId[] {
    const grids = this.stateByWorkspaceIdentifier.get(workspaceIdentifier)?.grids ?? {};
    return Object.values(grids).flatMap((grid) => this.leafTerminalIds(grid));
  }

  findWorkspaceIdentifierByTerminalId(terminalId: TerminalId): string | undefined {
    return this.locate(terminalId)?.workspaceIdentifier;
  }

  findTabIdByTerminalId(terminalId: TerminalId): TabId | undefined {
    return this.locate(terminalId)?.tabId;
  }

  removeWorkspaceRuntime(workspaceIdentifier: string): void {
    this.destroyWorkspaceGridList(this.stateByWorkspaceIdentifier.get(workspaceIdentifier)?.grids);
    this.stateByWorkspaceIdentifier.delete(workspaceIdentifier);
    if (this.activeWorkspaceIdentifier === workspaceIdentifier) {
      this.activeWorkspaceIdentifier = undefined;
      this.syncActiveWorkspaceState();
    }
  }

  get activeGridIsSplit$(): Observable<boolean> {
    return this.state$.pipe(
      map(({ grids, activeTabId }) => {
        const grid = activeTabId ? grids[activeTabId] : undefined;
        return grid ? !grid.tree.root.isLeaf : false;
      }),
      distinctUntilChanged(),
    );
  }

  constructor(
    private bus: AppBus,
    private componentFactory: SessionHostFactory,
    private readonly sessionRegistry: TerminalSessionRegistry,
    destroyRef: DestroyRef,
  ) {
    this.state$
      .pipe(
        map(({ grids, activeTabId }) => {
          const grid = activeTabId ? grids[activeTabId] : undefined;
          return grid ? this.leafTerminalIds(grid) : [];
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

    // Title, cwd, exit and focus come straight from the session's facts now,
    // tagged with the terminal id by the registry.
    this.sessionRegistry.facts$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(({ terminalId, fact }) => {
        switch (fact.type) {
          case "titleChanged":
            this.applyPaneTitle(terminalId, fact.title);
            break;
          case "cwdReported":
            this.applyPaneCwd(terminalId, fact.cwd);
            break;
          case "exited":
            // The shell ended: drop its pane (and the tab/session with the last
            // one). No bus hop - the session reports, the workbench acts.
            this.removePane(terminalId);
            break;
          case "focusChanged":
            if (fact.focused) this.applyPaneFocus(terminalId);
            break;
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
  }

  removePane(terminalId: TerminalId) {
    const gridList = this.getActiveWorkspaceGridList();
    const gridAndNode = this.locateInActiveWorkspace(terminalId);
    if (!gridAndNode) return;
    if (this.maximizedTerminalId === terminalId) {
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
    if (this.maximizedTerminalId === sourceTerminalId) {
      this.minimizePane();
    }
    const sourceGridAndNode = this.locateInActiveWorkspace(sourceTerminalId);
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
    const sourceGridAndNode = this.locateInActiveWorkspace(sourceTerminalId);
    const targetGridAndNode = this.locateInActiveWorkspace(targetTerminalId);
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
    if (!this.activeTabId) throw new Error("No active tab id found.");
    const gridList = this.getActiveWorkspaceGridList();
    const tree = gridList[this.activeTabId].tree;
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
    const state = this.stateByWorkspaceIdentifier.get(workspaceIdentifier);
    this.destroyWorkspaceGridList(state?.grids);
    // The workspace's own panes are gone; only the other workspaces' ids are taken.
    this.stateByWorkspaceIdentifier.set(workspaceIdentifier, { ...state, grids: {} });
    const takenTerminalIds = this.laidOutTerminalIds();
    const restoredGridList: GridList = {};
    for (const grid of gridConfigList) {
      restoredGridList[grid.tabId] = {
        tabId: grid.tabId,
        tree: this.createTree(grid, takenTerminalIds),
      };
    }
    this.stateByWorkspaceIdentifier.set(workspaceIdentifier, { ...state, grids: restoredGridList });
    this.ensureSessions(restoredGridList);
    if (this.activeWorkspaceIdentifier === workspaceIdentifier) {
      this.state$.next({ ...this.state$.value, grids: { ...restoredGridList } });
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
    const gridList = this.stateByWorkspaceIdentifier.get(targetWorkspaceIdentifier)?.grids ?? {};
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
    gridList[gridConfig.tabId] = {
      tabId: gridConfig.tabId,
      tree: this.createTree(gridConfig, this.laidOutTerminalIds()),
    };
    this.setActiveWorkspaceGridList(gridList);
  }

  /** Every terminal id laid out in any workspace. */
  private laidOutTerminalIds(): Set<TerminalId> {
    const ids = new Set<TerminalId>();
    for (const { grids } of this.stateByWorkspaceIdentifier.values()) {
      for (const grid of Object.values(grids)) {
        for (const terminalId of this.leafTerminalIds(grid)) ids.add(terminalId);
      }
    }
    return ids;
  }

  private createTree(paneConfig: GridConfig, takenTerminalIds: Set<TerminalId>): BinaryTree<Pane> {
    const rootNode: BinaryNode<Pane> = new BinaryNode();
    this.addNode(rootNode, paneConfig.pane, takenTerminalIds);
    return new BinaryTree(rootNode);
  }

  private addNode(
    parent: BinaryNode<Pane>,
    nodeConfig: PaneConfig,
    takenTerminalIds: Set<TerminalId>,
  ) {
    if (nodeConfig.splitDirection) {
      parent.data = { splitDirection: nodeConfig.splitDirection, ratio: nodeConfig.ratio };
      if (!nodeConfig.leftChild || !nodeConfig.rightChild) {
        throw new Error("Invalid split pane configuration");
      }
      const leftChild: BinaryNode<Pane> = new BinaryNode();
      const rightChild: BinaryNode<Pane> = new BinaryNode();
      parent.addToNode(leftChild, "l");
      parent.addToNode(rightChild, "r");
      this.addNode(leftChild, nodeConfig.leftChild, takenTerminalIds);
      this.addNode(rightChild, nodeConfig.rightChild, takenTerminalIds);
    } else {
      // Reuse the persisted terminal id so restored scrollback (keyed by it)
      // matches; generate one for a fresh pane (step 27). A terminal id names
      // one session in one pane: a persisted id that is laid out already is a
      // defect in the data, and the pane gets a new id rather than that session.
      const persistedTerminalId = nodeConfig.terminalId;
      if (persistedTerminalId && takenTerminalIds.has(persistedTerminalId)) {
        console.error(
          `[grid-list] Terminal ${persistedTerminalId} is laid out twice; the second pane gets a new id.`,
        );
      }
      const terminalId =
        persistedTerminalId && !takenTerminalIds.has(persistedTerminalId)
          ? persistedTerminalId
          : IdCreator.newTerminalId();
      takenTerminalIds.add(terminalId);
      parent.data = {
        shellName: nodeConfig.shellName,
        workingDir: nodeConfig.workingDir,
        title: nodeConfig.title,
        terminalId,
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
    const terminalIds = this.leafTerminalIds(grid);
    delete gridList[tab];
    for (const terminalId of terminalIds) {
      this.componentFactory.destroy(terminalId);
    }
    this.setActiveWorkspaceGridList(gridList);
    if (this.activeTabId === tab) {
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
    if (!this.activeTabId) throw new Error("No active tab id found.");
    const gridList = this.getActiveWorkspaceGridList();
    const focused = this.locateInActiveWorkspace(terminalId);
    if (!focused?.node.data || focused.tabId !== this.activeTabId) return;
    const currentFocusedTab = focused.grid.tree.first(
      (s) => (s.isLeaf && s.data?.isFocused) ?? false,
    );
    if (currentFocusedTab?.data) currentFocusedTab.data.isFocused = false;
    focused.node.data.isFocused = true;
    this.setActiveWorkspaceGridList(gridList);
    this.publishPaneTitleToTab(focused.tabId, focused.node.data);
  }

  private applyPaneTitle(terminalId: TerminalId, title: string): void {
    if (!title) return;
    const gridList = this.getActiveWorkspaceGridList();
    const gridAndNode = this.locateInActiveWorkspace(terminalId);
    if (!gridAndNode?.node.data) return;
    gridAndNode.node.data = { ...gridAndNode.node.data, title };
    this.setActiveWorkspaceGridList(gridList);
    if (gridAndNode.node.data.isFocused) {
      this.publishPaneTitleToTab(gridAndNode.tabId, gridAndNode.node.data);
    }
  }

  private applyPaneCwd(terminalId: TerminalId, cwd: string): void {
    if (!cwd) return;
    const gridList = this.getActiveWorkspaceGridList();
    const gridAndNode = this.locateInActiveWorkspace(terminalId);
    if (!gridAndNode?.node.data) return;
    gridAndNode.node.data = { ...gridAndNode.node.data, workingDir: cwd };
    this.setActiveWorkspaceGridList(gridList);
    if (gridAndNode.node.data.isFocused && !gridAndNode.node.data.title) {
      this.publishPaneTitleToTab(gridAndNode.tabId, gridAndNode.node.data);
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
    if (this.maximizedTerminalId === terminalId) {
      this.minimizePane();
      return;
    }
    this.maximizePane(terminalId);
  }

  private minimizePane(): void {
    if (!this.maximizedTerminalId) return;
    this.setActiveWorkspaceMaximizedTerminalIdentifier(undefined);
    this.bus.publish({ type: "PaneMaximizedChanged", payload: { terminalId: undefined } });
  }

  private get activeTabId(): TabId | undefined {
    return this.state$.value.activeTabId;
  }

  private get maximizedTerminalId(): TerminalId | undefined {
    return this.state$.value.maximizedTerminalId;
  }

  private getActiveGrid(): Grid | undefined {
    if (!this.activeTabId) return;
    return this.state$.value.grids[this.activeTabId];
  }

  private leafTerminalIds(grid: Grid): TerminalId[] {
    return grid.tree
      .find((node) => node.isLeaf)
      .map((node) => node.data?.terminalId)
      .filter((terminalId): terminalId is TerminalId => terminalId !== undefined);
  }

  /** Finds the pane of a terminal, in one workspace or - without one - in all of them. */
  private locate(
    terminalId: TerminalId | undefined,
    workspaceIdentifier?: string,
  ): PaneLocation | undefined {
    if (!terminalId) return;
    for (const [identifier, { grids }] of this.stateByWorkspaceIdentifier) {
      if (workspaceIdentifier && identifier !== workspaceIdentifier) continue;
      for (const grid of Object.values(grids)) {
        const node = grid.tree.first((p) => p.data?.terminalId === terminalId);
        if (node?.isLeaf) {
          return { workspaceIdentifier: identifier, tabId: grid.tabId, grid, node };
        }
      }
    }
    return;
  }

  private locateInActiveWorkspace(terminalId: TerminalId | undefined): PaneLocation | undefined {
    return this.locate(terminalId, this.getRequiredActiveWorkspaceIdentifier());
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

  private getActiveWorkspaceState(): WorkspaceGrids {
    const workspaceIdentifier = this.getRequiredActiveWorkspaceIdentifier();
    let state = this.stateByWorkspaceIdentifier.get(workspaceIdentifier);
    if (!state) {
      state = { grids: {} };
      this.stateByWorkspaceIdentifier.set(workspaceIdentifier, state);
    }
    return state;
  }

  private getActiveWorkspaceGridList(): GridList {
    return this.getActiveWorkspaceState().grids;
  }

  private setActiveWorkspaceGridList(gridList: GridList): void {
    this.getActiveWorkspaceState().grids = gridList;
    this.ensureSessions(gridList);
    this.state$.next({ ...this.state$.value, grids: { ...gridList } });
  }

  private setActiveWorkspaceTabIdentifier(tabIdentifier: TabId | undefined): void {
    this.getActiveWorkspaceState().activeTabId = tabIdentifier;
    this.state$.next({ ...this.state$.value, activeTabId: tabIdentifier });
  }

  private setActiveWorkspaceMaximizedTerminalIdentifier(terminalId: TerminalId | undefined): void {
    this.getActiveWorkspaceState().maximizedTerminalId = terminalId;
    this.state$.next({ ...this.state$.value, maximizedTerminalId: terminalId });
  }

  private syncActiveWorkspaceState(): void {
    const state = this.activeWorkspaceIdentifier
      ? this.stateByWorkspaceIdentifier.get(this.activeWorkspaceIdentifier)
      : undefined;
    this.state$.next({ ...state, grids: { ...state?.grids } });
  }

  private destroyWorkspaceGridList(gridList: GridList | undefined): void {
    if (!gridList) return;
    for (const grid of Object.values(gridList)) {
      for (const terminalId of this.leafTerminalIds(grid)) {
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
