import {Component, OnInit, ViewEncapsulation} from '@angular/core';
import {Observable} from 'rxjs';
import {BinaryTree} from '../../common/tree/binary-tree';
import {TerminalComponent} from '../../terminal/terminal.component';
import {tap} from 'rxjs/operators';
import {CommonModule} from '@angular/common';
import {PasteHistoryMenuComponent} from '../paste-history-menu/paste-history-menu.component';
import {TitlebarMenuComponent} from '../titlebar-menu/titlebar-menu.component';
import {Pane} from '../+models/pane';
import {Tab} from '../+models/tab';
import {SettingsService} from '../../settings/+state/settings.service';
import {WindowManagementService} from "../+state/window-management.service";
import {GridPaneComponent} from "./grid-pane/grid-pane.component";

@Component({
    imports: [
        CommonModule,
        GridPaneComponent,
        PasteHistoryMenuComponent,
        //ActionsComponent,
        //WorkspacesMenuComponent,
        //TabContextMenuComponent,
        //TitlebarMenuComponent,
        //AutocompleteComponent,
        //AboutComponent,
        //ReleaseNotesComponent,
        //SettingsComponent,
        //TerminalComponent
    ],
    selector: 'app-grid',
    encapsulation: ViewEncapsulation.None,
    styleUrls: ['./grid.component.scss'],
    templateUrl: './grid.component.html'
})
export class GridComponent {

  public tree: Observable<BinaryTree<Pane>>;
  public tabs: Observable<Tab[]>;

  constructor(private windowManagementService: WindowManagementService) {
    this.tree = this.windowManagementService.selectTree();
    this.tabs = this.windowManagementService.selectAllTabs();
  }
}
