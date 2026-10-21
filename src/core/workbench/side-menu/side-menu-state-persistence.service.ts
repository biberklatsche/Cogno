import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed, toObservable } from "@angular/core/rxjs-interop";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { SideMenuService } from "@cogno/core/workbench/side-menu/+state/side-menu.service";
import { combineLatest, debounceTime, filter, skip } from "rxjs";
import { SideMenuPanelEntity, SideMenuStateRepository } from "./side-menu-state.repository";

@Injectable({ providedIn: "root" })
export class SideMenuStatePersistenceService {
  private dbInitialized = false;

  constructor(
    private readonly bus: AppBus,
    private readonly sideMenuService: SideMenuService,
    private readonly repository: SideMenuStateRepository,
    destroyRef: DestroyRef,
  ) {
    this.bus.once$("DBInitialized").subscribe(() => {
      void this.restore();
    });

    // The open panel decides which docked panel comes back; the rest is per panel.
    combineLatest([
      toObservable(this.sideMenuService.selectedItem),
      toObservable(this.sideMenuService.pinnedLabels),
      toObservable(this.sideMenuService.expandedLabels),
      toObservable(this.sideMenuService.panelWidths),
    ])
      .pipe(
        skip(1),
        debounceTime(500),
        filter(() => this.dbInitialized),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe(() => {
        void this.repository.savePanels(this.panels());
      });
  }

  private panels(): SideMenuPanelEntity[] {
    const pinned = this.sideMenuService.pinnedLabels();
    const expanded = this.sideMenuService.expandedLabels();
    const widths = this.sideMenuService.panelWidths();
    const docked = this.sideMenuService.dockedPanelLabel();
    const labels = new Set([...pinned, ...expanded, ...widths.keys()]);
    return [...labels].map((label) => ({
      label,
      is_pinned: pinned.has(label) ? 1 : 0,
      is_expanded: expanded.has(label) ? 1 : 0,
      width_pixels: widths.get(label) ?? null,
      is_open: label === docked ? 1 : 0,
    }));
  }

  private async restore(): Promise<void> {
    const panels = await this.repository.loadPanels();
    this.sideMenuService.setPinnedLabels(panels.filter((p) => p.is_pinned).map((p) => p.label));
    this.sideMenuService.setExpandedLabels(panels.filter((p) => p.is_expanded).map((p) => p.label));
    this.sideMenuService.setPanelWidths(
      new Map(panels.flatMap((p) => (p.width_pixels === null ? [] : [[p.label, p.width_pixels]]))),
    );
    this.dbInitialized = true;

    // The docked panel comes back beside the terminals, which keep the keyboard.
    const open = panels.find((p) => p.is_open && p.is_pinned);
    if (open) this.sideMenuService.open(open.label, false);
  }
}
