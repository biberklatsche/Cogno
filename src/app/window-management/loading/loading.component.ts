import {Component, EventEmitter, Input, Output} from '@angular/core';
import {CommonModule} from '@angular/common';
import {LoaderComponent} from '../../+shared/components/loader/loader.component';

@Component({
    selector: 'app-loading',
    templateUrl: './loading.component.html',
    styleUrls: ['./loading.component.scss'],
    imports: [
        CommonModule,
        LoaderComponent
    ]
})
export class LoadingComponent {
  @Input()
  public isVisible = false;
  @Input()
  public hasError = false;
  @Output()
  public onCloseTab: EventEmitter<any> = new EventEmitter<any>();
  @Output()
  public onRemove: EventEmitter<any> = new EventEmitter<any>();
  @Output()
  public onOpenSettings: EventEmitter<any> = new EventEmitter<any>();

  public blur = true;

  constructor() {

  }

  showOutput() {
    this.blur = false;
  }

  removeLoadingContainer() {
    this.isVisible = false;
    this.onRemove.next(null);
  }

  closeTab() {
    this.onCloseTab.next(null);
  }

  openSettings() {
    this.onOpenSettings.next(null);
  }
}
