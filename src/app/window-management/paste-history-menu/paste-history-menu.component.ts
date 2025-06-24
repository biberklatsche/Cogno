import {ChangeDetectionStrategy, Component, ElementRef} from '@angular/core';
import {Observable} from 'rxjs';
import {MenuComponent} from '../../+shared/abstract-components/menu/menu.component';
import {Key} from '../../common/key';
import {PasteService} from './+state/paste.service';
import {KeyboardService} from '../../+shared/services/keyboard/keyboard.service';
import {CommonModule} from '@angular/common';
import {KeytipService} from '../../+shared/services/keyboard/keytip.service';

@Component({
    selector: 'app-paste-history-menu',
    templateUrl: './paste-history-menu.component.html',
    styleUrls: ['./paste-history-menu.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule
    ]
})
export class PasteHistoryMenuComponent extends MenuComponent {

  pasteHistory: Observable<string[]>;
  selectedIndex: Observable<number>;
  isActive: Observable<boolean>;

  constructor(
    protected elementRef: ElementRef,
    private pasteService: PasteService,
    public keyboardService: KeyboardService,
    public keytipService: KeytipService
    )
  {
    super( elementRef, pasteService, keyboardService, keytipService);
    this.pasteHistory = this.pasteService.selectHistory();
    this.selectedIndex = this.pasteService.selectSelectedIndex();
    super.addKeydownListener(event => this.onKeyDown(event));
    super.openOnShortcut('showPasteHistory');
    this.isActive = pasteService.selectIsActive();
  }

  executeCommandAtIndex(index: number) {
    this.pasteService.pasteEntryAtIndex(index);
    this.closeMenu();
  }

  private onKeyDown(event: KeyboardEvent) {
    event.preventDefault();
    this.pasteService.updateKeyEvent(event);
    if (event.key === Key.Enter) {
      this.closeMenu();
    }
  }
}
