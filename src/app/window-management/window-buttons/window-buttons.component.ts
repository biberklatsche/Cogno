import {Component, OnInit} from '@angular/core';
import {BehaviorSubject, combineLatest, Observable} from 'rxjs';
import {platform} from 'os';
import {WindowButtonsService} from './+state/window-buttons.service';
import {GlobalMenuService} from '../../+shared/abstract-components/menu/+state/global-menu.service';
import {CommonModule} from '@angular/common';
import {IconComponent} from '../../+shared/components/icon/icon.component';
import {Workspace} from '../../+shared/models/workspace';
import {map} from 'rxjs/operators';
import {Icon} from '../../+shared/components/icon/icon';

@Component({
    selector: 'app-window-buttons',
    templateUrl: './window-buttons.component.html',
    styleUrls: ['./window-buttons.component.scss'],
    imports: [
        CommonModule,
        IconComponent
    ]
})
export class WindowButtonsComponent implements OnInit {

  public isMaximized: Observable<boolean>;
  public os = platform();
  public isUpdateAvailable: Observable<boolean>;
  public isDarkModeAvailable: Observable<boolean>;
  public isInDarkMode: Observable<boolean>;
  public selectedWorkspace: Observable<Workspace>;
  public icon: Observable<Icon>;
  private darkmodeButtonHover = new BehaviorSubject(false);

  constructor(private readonly service: WindowButtonsService, private readonly menuService: GlobalMenuService) { }

  ngOnInit() {
    this.isMaximized = this.service.selectIsMaximized();
    this.isUpdateAvailable = this.service.selectIsUpdateAvailable();
    this.isDarkModeAvailable = this.service.selectIsDarkModeAvailable();
    this.isInDarkMode = this.service.selectIsInDarkMode();
    this.selectedWorkspace = this.service.selectSelectedWorkspace();

    this.icon = combineLatest([this.isInDarkMode, this.darkmodeButtonHover.asObservable()]).pipe(map(([isInDarkMode, isHover]) => {
      if (isHover) {return 'mdiThemeLightDark';}
      return isInDarkMode ? 'mdiWeatherNight' : 'mdiWeatherSunny';
    }));
  }

  close() {
    this.service.closeWindow();
  }

  minimize() {
    this.service.minimizeWindow();
  }

  toggleMaximize() {
    this.service.toggleMaximizeWindow();
  }

  toggleWorkspace() {
    this.menuService.toggleMenu('Workspaces');
  }

  update(): void {
    this.service.showUpdateNotification();
  }

  toggleDarkMode(): void {
    this.service.toggleDarkMode();
  }

  openNewWindow(): void {
    this.service.openNewWindow();
  }

  darkmodeButtonLeave() {
    this.darkmodeButtonHover.next(false);
  }

  darkmodeButtonEnter() {
    this.darkmodeButtonHover.next(true);
  }
}
