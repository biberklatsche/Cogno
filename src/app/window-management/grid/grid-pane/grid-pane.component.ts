import {Component, ElementRef, HostBinding, Input, ViewChild} from '@angular/core';
import {BinaryNode} from '../../../common/tree/binary-tree';
import {Pane, SplitDirection} from '../../../+shared/models/pane';
import {WindowManagementService} from '../../+state/window-management.service';
import {WindowService} from '../../../+shared/services/window/window.service';
import {GridTabsComponent} from '../grid-tabs/grid-tabs.component';
import {CommonModule} from '@angular/common';

@Component({
    selector: 'app-grid-pane',
    templateUrl: './grid-pane.component.html',
    styleUrls: ['./grid-pane.component.scss'],
    imports: [
        CommonModule,
        GridTabsComponent
    ]
})
export class GridPaneComponent {

  _node: BinaryNode<Pane>;
  @Input()
  public set node(val: BinaryNode<Pane>) {
    this._node = val;
    this.calcStyle();
  }

  @HostBinding('class') classes;

  @ViewChild('first')
  firstRef: ElementRef;
  @ViewChild('splitter')
  splitter: ElementRef;
  @ViewChild('second')
  secondRef: ElementRef;

  private readonly WITH_OF_SPLITTER = 4;

  constructor(private elRef: ElementRef, private windowService: WindowService, private gridService: WindowManagementService) {
  }

  calcStyle(): void {
    if (this._node.data) {
      switch (this._node.data.splitDirection) {
        case SplitDirection.Horizontal:
          this.classes = 'horizontal';
          break;
        case SplitDirection.Vertical:
          this.classes = 'vertical';
          break;
      }
    }
    setTimeout(t => {
      const htmlElement = (this.elRef.nativeElement as HTMLElement);
      if (this.splitter != null) {
        const page = (this.splitter.nativeElement as HTMLElement).getBoundingClientRect();
        const ratioX = this._node.data.splitDirection === SplitDirection.Vertical && this._node.data.ratio ? this._node.data.ratio : 0.5;
        const ratioY = this._node.data.splitDirection === SplitDirection.Horizontal && this._node.data.ratio ? this._node.data.ratio : 0.5;
        this.setSize(htmlElement.offsetLeft + ((htmlElement.offsetWidth - this.WITH_OF_SPLITTER) * ratioX), page.top * ratioY / 0.5);
      }
      this.windowService.resize();
    }, 100);
  }


  startResize() {
    window.addEventListener('mouseup', this.stopResize);
    window.addEventListener('mousemove', this.resize);
  }

  setSize(pageX: number, pageY: number) {
    if (pageX > 0 || pageY > 0) {
      const htmlElement = (this.elRef.nativeElement as HTMLElement);
      const horizontal = htmlElement.className.includes('horizontal');
      const nativeFirst = ((this.firstRef as any).elRef.nativeElement as HTMLElement);
      const nativeSecond = ((this.secondRef as any).elRef.nativeElement as HTMLElement);
      let basisFirst;
      let basisSecond;
      let min;
      if (horizontal) {
        min = 100;
        basisFirst = pageY - nativeFirst.offsetTop;
        basisSecond = htmlElement.offsetHeight - basisFirst - this.WITH_OF_SPLITTER;
      } else {
        min = 200;
        basisFirst = pageX - nativeFirst.offsetLeft;
        basisSecond = htmlElement.offsetWidth - basisFirst - this.WITH_OF_SPLITTER;
      }
      if (basisFirst < min || basisSecond < min) {
        return;
      }
      nativeFirst.style.flexBasis = basisFirst + 'px';
      nativeSecond.style.flexBasis = basisSecond + 'px';
      nativeFirst.dataset['ratio'] = (basisFirst / (basisFirst + basisSecond)).toString(10);
      nativeFirst.style.flexGrow = '1';
      nativeSecond.style.flexGrow = '1';
    }
  }

  resize = ($event: MouseEvent) => {
    $event.preventDefault();
    this.setSize($event.pageX, $event.pageY);
    this.updatePaneRatio();
  };

  stopResize = ($event: MouseEvent) => {
    $event.preventDefault();
    window.removeEventListener('mouseup', this.stopResize);
    window.removeEventListener('mousemove', this.resize);
    this.updatePaneRatio();
    this.gridService.fireGridChanged();
  };

  updatePaneRatio(){
      const ratio = Number.parseFloat(((this.firstRef as any).elRef.nativeElement as HTMLElement)?.dataset['ratio']);
      this.gridService.updatePaneRatio(this._node.key, ratio);
  }
}
