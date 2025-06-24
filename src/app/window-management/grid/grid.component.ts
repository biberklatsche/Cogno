import {Component, OnInit, ViewEncapsulation} from '@angular/core';
import {Observable} from 'rxjs';
import {BinaryTree} from '../../common/tree/binary-tree';
import {Pane} from '../../+shared/models/pane';
import {GridService} from '../+state/grid.service';
import {SettingsService} from '../../+shared/services/settings/settings.service';
import {GridPaneComponent} from './grid-pane/grid-pane.component';
import {PasteHistoryMenuComponent} from '../paste-history-menu/paste-history-menu.component';
import {ActionsComponent} from '../../actions/actions.component';
import {WorkspacesMenuComponent} from '../../workspaces-menu/workspaces-menu.component';
import {WindowButtonsComponent} from '../window-buttons/window-buttons.component';
import {TabContextMenuComponent} from '../tab-context-menu/tab-context-menu.component';
import {TitlebarMenuComponent} from '../titlebar-menu/titlebar-menu.component';
import {CommonModule} from '@angular/common';
import {AutocompleteComponent} from '../../autocomplete/autocomplete.component';
import {Tab} from '../../+shared/models/tab';
import {TabType} from '../../../../shared/models/models';
import {AboutComponent} from '../../about/about.component';
import {LoadingComponent} from '../loading/loading.component';
import {ReleaseNotesComponent} from '../../release-notes/release-notes.component';
import {SettingsComponent} from '../../settings/settings.component';
import {TerminalComponent} from '../../terminal/terminal.component';
import {tap} from 'rxjs/operators';

@Component({
    imports: [
        CommonModule,
        GridPaneComponent,
        PasteHistoryMenuComponent,
        ActionsComponent,
        WorkspacesMenuComponent,
        TabContextMenuComponent,
        TitlebarMenuComponent,
        AutocompleteComponent,
        AboutComponent,
        ReleaseNotesComponent,
        SettingsComponent,
        TerminalComponent
    ],
    selector: 'app-grid',
    encapsulation: ViewEncapsulation.None,
    styleUrls: ['./grid.component.scss'],
    templateUrl: './grid.component.html'
})
export class GridComponent implements OnInit {

  public tree: Observable<BinaryTree<Pane>>;
  public tabs: Observable<Tab[]>;
  public isLightBackground: Observable<boolean>;

  constructor(private gridService: GridService, private settingsService: SettingsService) {
  }

  ngOnInit(): void {
    this.tree = this.gridService.selectTree();
    this.tabs = this.gridService.selectAllTabs();
    this.isLightBackground = this.settingsService.selectIsLightBackground();
  }

  public trackByFn(index, item) {
    return item.id;
  }

  protected readonly TabType = TabType;
}
