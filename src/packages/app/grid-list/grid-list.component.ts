import { AsyncPipe } from "@angular/common";
import { Component } from "@angular/core";
import { TabId } from "@cogno/core-api";
import { Observable } from "rxjs";
import { SideMenuComponent } from "../menu/side-menu/side-menu/side-menu.component";
import { Grid } from "./+model/model";
import { GridListService } from "./+state/grid-list.service";
import { EmtpyComponent } from "./emtpy/emtpy.component";
import { GridComponent } from "./grid/grid.component";

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
