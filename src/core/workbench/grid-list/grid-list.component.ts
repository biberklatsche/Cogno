import { AsyncPipe } from "@angular/common";
import { Component, ElementRef, ViewChild } from "@angular/core";
import { TabId } from "@cogno/core/workbench/grid-layout";
import { Grid } from "@cogno/core/workbench/grid-list/+model/model";
import { GridListService } from "@cogno/core/workbench/grid-list/+state/grid-list.service";
import { EmtpyComponent } from "@cogno/core/workbench/grid-list/emtpy/emtpy.component";
import { GridComponent } from "@cogno/core/workbench/grid-list/grid/grid.component";
import { SideMenuComponent } from "@cogno/core/workbench/side-menu/side-menu.component";
import { Observable } from "rxjs";

@Component({
  selector: "app-grid-list",
  imports: [AsyncPipe, GridComponent, EmtpyComponent, SideMenuComponent],
  templateUrl: "./grid-list.component.html",
  styleUrl: "./grid-list.component.scss",
})
export class GridListComponent {
  @ViewChild("terminals") private terminals?: ElementRef<HTMLElement>;
  @ViewChild("terminalFloor") private terminalFloor?: ElementRef<HTMLElement>;

  gridList$: Observable<Grid[]>;
  activeTabId$: Observable<TabId | undefined>;

  /** How much wider the side panels can get before the terminals reach their floor. */
  readonly roomBesideTerminals = (): number => {
    const terminals = this.terminals?.nativeElement;
    const floor = this.terminalFloor?.nativeElement;
    if (!terminals || !floor) return 0;
    return Math.max(0, terminals.clientWidth - floor.offsetWidth);
  };

  constructor(gridListService: GridListService) {
    this.gridList$ = gridListService.grids$;
    this.activeTabId$ = gridListService.activeTabId$;
  }
}
