import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed, toObservable } from "@angular/core/rxjs-interop";
import { combineLatest, debounceTime, filter, skip } from "rxjs";
import { AppBus } from "../app-bus/app-bus";
import { SideMenuService } from "../menu/side-menu/+state/side-menu.service";
import { SideMenuStateRepository } from "./side-menu-state.repository";

@Injectable({ providedIn: "root" })
export class SideMenuStatePersistenceService {
  private dbInitialized = false;

  constructor(
    private readonly bus: AppBus,
    private readonly sideMenuService: SideMenuService,
    private readonly repository: SideMenuStateRepository,
    destroyRef: DestroyRef,
  ) {
    this.bus.onceType$("DBInitialized").subscribe(() => {
      void this.restore();
    });

    combineLatest([
      toObservable(this.sideMenuService.selectedItem),
      toObservable(this.sideMenuService.displacement),
      toObservable(this.sideMenuService.panelWidthInPixels),
    ])
      .pipe(
        skip(1),
        debounceTime(500),
        filter(() => this.dbInitialized),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe(([selectedItem, displacement, panelWidthInPixels]) => {
        void this.repository.save({
          selected_item_label: selectedItem?.label ?? null,
          is_pinned: selectedItem?.pinned ? 1 : 0,
          displacement: displacement ? 1 : 0,
          panel_width_pixels: panelWidthInPixels,
        });
      });
  }

  private async restore(): Promise<void> {
    const state = await this.repository.load();
    this.dbInitialized = true;

    if (!state) return;

    this.sideMenuService.setPanelWidthInPixels(state.panel_width_pixels);

    if (state.displacement !== 0 && !this.sideMenuService.displacement()) {
      this.sideMenuService.toggleDisplacement();
    }

    if (state.selected_item_label) {
      this.sideMenuService.open(state.selected_item_label);
      if (state.is_pinned && !this.sideMenuService.selectedItem()?.pinned) {
        this.sideMenuService.togglePin();
      }
    }
  }
}
