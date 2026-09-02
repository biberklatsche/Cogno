import { AsyncPipe } from "@angular/common";
import { Component } from "@angular/core";
import { Grid } from "@cogno/core/workbench/grid-list/+model/model";
import { GridListService } from "@cogno/core/workbench/grid-list/+state/grid-list.service";
import { EmtpyComponent } from "@cogno/core/workbench/grid-list/emtpy/emtpy.component";
import { GridComponent } from "@cogno/core/workbench/grid-list/grid/grid.component";
import { SideMenuComponent } from "@cogno/core/workbench/side-menu/side-menu/side-menu.component";
import { TabId } from "@cogno/shared/domain";
import { Observable } from "rxjs";

@Component({
  selector: "app-grid-list",
  imports: [AsyncPipe, GridComponent, EmtpyComponent, SideMenuComponent],
  templateUrl: "./grid-list.component.html",
  styleUrl: "./grid-list.component.scss",
})
export class GridListComponent {
  gridList$: Observable<Grid[]>;
  activeTabId$: Observable<TabId | undefined>;

  constructor(gridListService: GridListService) {
    this.gridList$ = gridListService.grids$;
    this.activeTabId$ = gridListService.activeTabId$;
  }
}
