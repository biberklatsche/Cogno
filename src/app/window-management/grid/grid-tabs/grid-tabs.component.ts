import {Component, ElementRef, Input, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {Observable, Subscription} from 'rxjs';
import {ShellType, TabType} from '../../../../../shared/models/models';
import {animate, style, transition, trigger} from '@angular/animations';
import {platform} from 'os';
import {TabContextMenuService} from '../../tab-context-menu/+state/tab-context-menu.service';
import {TitlebarMenuService} from '../../titlebar-menu/+state/titlebar-menu.service';
import {GridService} from '../../+state/grid.service';
import {WindowButtonsService} from '../../window-buttons/+state/window-buttons.service';
import {Tab} from '../../../+shared/models/tab';
import {CommonModule} from '@angular/common';
import {IconComponent} from '../../../+shared/components/icon/icon.component';
import {LoadingComponent} from '../../loading/loading.component';
import {AboutComponent} from '../../../about/about.component';
import {TerminalComponent} from '../../../terminal/terminal.component';
import {SettingsComponent} from '../../../settings/settings.component';
import {ReleaseNotesComponent} from '../../../release-notes/release-notes.component';
import {WelcomeComponent} from '../../../welcome/welcome.component';
import {Pane} from '../../../+shared/models/pane';
import {WindowService} from '../../../+shared/services/window/window.service';
import {WindowButtonsComponent} from "../../window-buttons/window-buttons.component";

@Component({
    selector: 'app-grid-tabs',
    templateUrl: './grid-tabs.component.html',
    styleUrls: ['./grid-tabs.component.scss'],
    animations: [
        trigger('addRemove', [
            transition(':enter', [
                style({ width: '0' }),
                animate('100ms ease-out', style({ width: '170px' }))
            ]),
            transition(':leave', [
                style({ width: '170px' }),
                animate('100ms ease-out', style({ width: '0' }))
            ]),
        ]),
    ],
  imports: [
    CommonModule,
    IconComponent,
    LoadingComponent,
    WelcomeComponent,
    WindowButtonsComponent
  ]
})
export class GridTabsComponent implements OnDestroy, OnInit {

  public pane: Observable<Pane>;
  public activeTabId: Observable<string>;
  public ShellType = ShellType;
  public TabType = TabType;
  public subscriptions: Subscription[] = [];
  public isFullScreen: Observable<boolean>;
  public isDragging: Observable<boolean>;

  public os = platform();

  @Input()
  public paneId: string;

  private zoneElements: Element[];

  @ViewChild('tabContent')
  private tabContent: ElementRef;

  constructor(
    private contextMenuService: TabContextMenuService,
    private titleBarMenuService: TitlebarMenuService,
    private windowButtonService: WindowButtonsService,
    private windowService: WindowService,
    private gridService: GridService
  ) {
  }

  ngOnInit(): void {
    this.pane = this.gridService.selectPane(this.paneId);
    this.activeTabId = this.gridService.selectActiveTabId();
    this.isFullScreen = this.windowButtonService.selectIsFullScreen();
    this.isDragging = this.gridService.isDragging();
    this.subscriptions.push(this.windowService.onResize.subscribe(() => {
      this.recalculateSize(this.gridService.getTabsOnPane(this.paneId));
    }));
  }

  addTab() {
    this.gridService.addNewTab(this.paneId, TabType.Terminal);
    this.gridService.fireGridChanged();
  }

  closeTabMiddle(event: MouseEvent, tab: Tab) {
    if (event.which === 2) {
      this.closeTab(event, tab);
    }
  }

  closeTab(event: Event, tab: Tab) {
    event?.stopPropagation();
    event?.preventDefault();
    this.gridService.closeTabs(tab.id);
    this.gridService.fireGridChanged();
  }

  removeErrorFlagOnTab($event: any, tab: Tab) {
    $event?.stopPropagation();
    $event?.preventDefault();
    this.gridService.removeErrorFlagOnTab(tab.id);
  }

  openSettings() {
    this.gridService.addNewTabOnActivePane(TabType.Settings);
    this.gridService.fireGridChanged();
  }

  focusTab(tab: Tab) {
    this.gridService.focusTab(tab.id);
  }

  private recalculateSize(tabs: Tab[]): void {
    if(!this.tabContent?.nativeElement) {return;}
    const clientRect = this.tabContent.nativeElement.getBoundingClientRect();
    const left = clientRect.left + document.body.scrollLeft;
    const top = clientRect.top + document.body.scrollTop;
    const width = clientRect.width;
    const height = clientRect.height;
    for (const tab of tabs) {
      const tabContent = document.getElementById(tab.id) as HTMLElement;
      if(!tabContent) {continue;}
      if(tab.isSelected) {
        tabContent.style.top = top + 'px';
        tabContent.style.left = left + 'px';
        tabContent.style.width = width + 'px';
        tabContent.style.height = height + 'px';
      } else {
        tabContent.style.top = '-100000px';
        tabContent.style.left = '0px';
        tabContent.style.width = width + 'px';
        tabContent.style.height = height + 'px';
      }
    }

  }

  toggleTitleBarMenu(event: MouseEvent) {
    const element = event.target as HTMLElement;

    // Get the bounding rectangle of the element
    const rect = element.getBoundingClientRect();

    // Coordinates relative to the viewport
    const x = rect.right;
    const y = rect.bottom;

    this.titleBarMenuService.openMenuOnPosition(this.paneId, {x, y});
  }

  public dragStart(event: DragEvent, item: Tab) {
    event.dataTransfer.effectAllowed = 'move';
    (event.target as HTMLElement).style.opacity = '0.5';
    this.zoneElements = Array.from(document.getElementsByClassName('drop-zone'));
    for (const elem of this.zoneElements) {
      elem.classList.remove('drag-window');
    }
    this.gridService.updateTabToDrag(item.id);
  }

  public dragEnd(event: DragEvent) {
    (event.target as HTMLElement).style.opacity = null;
    for (const elem of this.zoneElements) {
      elem.classList.add('drag-window');
    }
    this.zoneElements = undefined;
  }

  public dragEnter(event: DragEvent) {
    event.preventDefault();
    (event.target as HTMLElement).classList.add('drop');
  }

  public dragLeaf(event: DragEvent) {
    (event.target as HTMLElement).classList.remove('drop');
  }

  public drop(event: DragEvent, item: Tab) {
    event.preventDefault();
    (event.target as HTMLElement).classList.remove('drop');
    if (!!item) {
      this.gridService.updateDropTabId(item.id);
    } else {
      this.gridService.updateDropTabIdByPane(this.paneId);
    }
    this.gridService.fireGridChanged();
  }

  public dragOver(event: DragEvent) {
    event.preventDefault();
  }

  public trackByFn(index, item) {
    return item.id;
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  showContextMenu(event: any, tab: Tab) {
    const x = event['clientX'];
    const y = event['clientY'];
    this.contextMenuService.openMenuOnPosition(tab.id, {x, y});
  }

  copyTab(tab: Tab) {
    this.gridService.duplicateTab(tab.id);
    this.gridService.fireGridChanged();
  }

  protected readonly Pane = Pane;
}
