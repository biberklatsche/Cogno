import { Component } from '@angular/core';
import {GridListService} from "./+state/grid-list.service";
import {Observable} from "rxjs";
import {Grid} from "./+model/model";
import {AsyncPipe, JsonPipe} from "@angular/common";
import {GridComponent} from "./grid/grid.component";

@Component({
  selector: 'app-grid-list',
    imports: [
        AsyncPipe,
        GridComponent,
        JsonPipe
    ],
  templateUrl: './grid-list.component.html',
  styleUrl: './grid-list.component.scss'
})
export class GridListComponent {

    gridList$: Observable<Grid[]>;

    constructor(gridListService: GridListService) {
        this.gridList$ = gridListService.grids$;
    }
}
