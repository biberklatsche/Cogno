import {Component, ElementRef} from '@angular/core';
import {MenuComponent} from '../../+shared/abstract-components/menu/menu.component';
import {Position, ShellType, TabType,} from '../../../../shared/models/models';
import {Observable, tap} from 'rxjs';
import {ShellConfig} from '../../../../shared/models/settings';
import {TitlebarMenuService} from './+state/titlebar-menu.service';
import {Key} from '../../common/key';
import {KeyboardService} from '../../+shared/services/keyboard/keyboard.service';
import {Shortcuts} from '../../../../shared/models/shortcuts';
import {CommonModule} from '@angular/common';
import {IconComponent} from '../../+shared/components/icon/icon.component';
import {ShortcutPipe} from '../../+shared/pipes/shortcut/shortcut.pipe';
import {ShellIconComponent} from '../../+shared/components/shell-icon/shell-icon.component';
import {KeytipService} from '../../+shared/services/keyboard/keytip.service';

@Component({
    selector: 'app-titlebar-menu',
    templateUrl: './titlebar-menu.component.html',
    styleUrls: ['./titlebar-menu.component.scss'],
    imports: [
        CommonModule,
        IconComponent,
        ShellIconComponent,
        ShortcutPipe
    ]
})
export class TitlebarMenuComponent extends MenuComponent{

  public ShellType = ShellType;
  public positionStyle: any = {};
  public shortcuts: Observable<Shortcuts>;
  public shellConfigs: Observable<ShellConfig[]>;
  public isVisible: Observable<boolean>;

  constructor(protected elementRef: ElementRef, public keyboardService: KeyboardService, public keytipService: KeytipService, public menuService: TitlebarMenuService) {
    super(elementRef, menuService, keyboardService, keytipService);
    this.shortcuts = keyboardService.selectShortcuts();
    this.shellConfigs = menuService.selectShellConfigs();
    this.isVisible = this.menuService.selectIsActive().pipe(
      tap((active) => {
        if (active) {
          this.positionStyle = this.calculatePositionStyle(this.menuService.getClickPosition());
        }
      })
    );
  }

  private calculatePositionStyle(position: Position): any {
    if (position) {
      const correctPosition = {x: position.x - 30, y: position.y - 10};
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

  public openSettings() {
    this.menuService.openSettings();
  }

  public openAbout() {
    this.menuService.openAbout();
  }

  public openReleaseNotes() {
    this.menuService.openReleaseNotes();
  }

  public openReportIssue() {
    this.menuService.openReportIssue();
  }

  public openDonation() {
    this.menuService.openDonation();
  }

  openReddit() {
    this.menuService.openReddit();
  }

  openShell(shellConfig: ShellConfig) {
    this.menuService.openShell(TabType.Terminal, shellConfig);
  }
}
