import { Component } from '@angular/core';
import {GridListService} from "./+state/grid-list.service";
import {Observable} from "rxjs";
import {Grid} from "./+model/model";
import {AsyncPipe,} from "@angular/common";
import {GridComponent} from "./grid/grid.component";
import {TabId} from "@cogno/core-api";
import {EmtpyComponent} from "./emtpy/emtpy.component";
import {SideMenuComponent} from "../menu/side-menu/side-menu/side-menu.component";

@Component({
  selector: 'app-grid-list',
    imports: [
        AsyncPipe,
        GridComponent,
        EmtpyComponent,
        SideMenuComponent
    ],
  templateUrl: './grid-list.component.html',
  styleUrl: './grid-list.component.scss'
})
export class GridListComponent {

    gridList$: Observable<Grid[]>;
    activeTabId$: Observable<TabId | undefined>;

    constructor(gridListService: GridListService) {
        this.gridList$ = gridListService.grids$;
        this.activeTabId$ = gridListService.activeTabId$;
    }
}



