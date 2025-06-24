import {ChangeDetectionStrategy, Component, ElementRef, ViewChild} from '@angular/core';
import {Observable, tap} from 'rxjs';
import {Position} from '../../../../shared/models/models';
import {Shortcuts} from '../../../../shared/models/shortcuts';
import {MenuComponent} from '../../+shared/abstract-components/menu/menu.component';
import {TabContextMenuService} from './+state/tab-context-menu.service';
import {KeyboardService} from '../../+shared/services/keyboard/keyboard.service';
import {CommonModule} from '@angular/common';
import {IconComponent} from '../../+shared/components/icon/icon.component';
import {ShortcutPipe} from '../../+shared/pipes/shortcut/shortcut.pipe';
import {KeytipService} from '../../+shared/services/keyboard/keytip.service';

@Component({
    selector: 'app-tab-context-menu',
    templateUrl: './tab-context-menu.component.html',
    styleUrls: ['./tab-context-menu.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        IconComponent,
        ShortcutPipe
    ]
})
export class TabContextMenuComponent extends MenuComponent{

  @ViewChild('tabName') tabElement: ElementRef;
  positionStyle: any = {};
  showAdvancedTab: Observable<boolean>;
  showAdvancedPane: Observable<boolean>;
  isVisible: Observable<boolean>;
  shortcuts: Observable<Shortcuts>;

  constructor(elementRef: ElementRef, protected keyboardService: KeyboardService, protected keytipService: KeytipService,protected menuService: TabContextMenuService) {
    super(elementRef, menuService, keyboardService, keytipService);
    this.isVisible = this.menuService.selectIsActive().pipe(
        tap((active) => {
          if (active) {
            this.positionStyle = this.calculatePositionStyle(this.menuService.getClickPosition());
          }
        })
      );
    this.showAdvancedTab = this.menuService.selectShowAdvancedTab();
    this.showAdvancedPane = this.menuService.selectShowAdvancedPane();
    this.shortcuts = this.keyboardService.selectShortcuts();
  }

  private calculatePositionStyle(position: Position): any {
    if (position) {
      const correctPosition = {x: position.x - 50, y: position.y - 5};
      const parentWidth = (this.eRef.nativeElement as HTMLElement).parentElement.offsetWidth;
      const widthOfContainerInPx = 260;
      if (correctPosition.x + widthOfContainerInPx > parentWidth) {
        correctPosition.x = parentWidth - widthOfContainerInPx - 20;
      }
      if (correctPosition.x <= 10) {
        correctPosition.x = 10;
      }
      return {
        'top': correctPosition.y + 'px',
        'left': correctPosition.x + 'px'
      };
    }
  }

  splitHorizontal() {
    this.menuService.splitHorizontal();
    this.closeMenu();
  }

  splitVertical() {
    this.menuService.splitVertical();
    this.closeMenu();
  }

  splitAndMoveRight() {
    this.menuService.splitAndMoveRight();
    this.closeMenu();
  }

  splitAndMoveDown() {
    this.menuService.splitAndMoveDown();
    this.closeMenu();
  }

  unsplit() {
    this.menuService.unsplit();
    this.closeMenu();
  }

  swap() {
    this.menuService.swap();
    this.closeMenu();
  }

  closeOtherTabs() {
    this.menuService.closeOtherTabs();
    this.closeMenu();
  }

  duplicateTab() {
    this.menuService.duplicateTab();
    this.closeMenu();
  }

  closeTab() {
    this.menuService.closeTab();
    this.closeMenu();
  }

  closeAllTabs() {
    this.menuService.closeAllTabs();
    this.closeMenu();
  }
}
