import {Component, ElementRef, HostBinding, Input, ViewChild} from '@angular/core';
import {BinaryNode} from '../../../common/tree/binary-tree';
import {WindowManagementService} from '../../+state/window-management.service';
import {GridTabsComponent} from '../grid-tabs/grid-tabs.component';
import {CommonModule} from '@angular/common';
import {Pane} from "../../+models/pane";

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

  _node: BinaryNode<Pane> | undefined = undefined;
  @Input()
  public set node(val: BinaryNode<Pane>) {
    this._node = val;
    this.calcStyle();
  }

  @HostBinding('class') classes : string | undefined = undefined;

  @ViewChild('first')
  firstRef: ElementRef | undefined = undefined;
  @ViewChild('splitter')
  splitter: ElementRef | undefined = undefined;
  @ViewChild('second')
  secondRef: ElementRef | undefined = undefined;

  private readonly WITH_OF_SPLITTER = 4;

  constructor(private elRef: ElementRef, private windowService: WindowService, private gridService: WindowManagementService) {
  }

  calcStyle(): void {
    if (this._node?.data) {
        this.classes = this._node?.data.splitDirection
    }
    setTimeout(t => {
      const htmlElement = (this.elRef.nativeElement as HTMLElement);
      if (this.splitter != null) {
        const page = (this.splitter.nativeElement as HTMLElement).getBoundingClientRect();
        const ratioX = this._node?.data.splitDirection === 'vertical' && this._node.data.ratio ? this._node.data.ratio : 0.5;
        const ratioY = this._node?.data.splitDirection === 'horizontal' && this._node.data.ratio ? this._node.data.ratio : 0.5;
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
      if(!this._node?.key || !this.firstRef) return
      const ratioAsString = (this.firstRef.nativeElement as HTMLElement)?.dataset['ratio'] ?? '0.5';
      const ratio = Number.parseFloat(ratioAsString);
      this.gridService.updatePaneRatio(this._node.key, ratio);
  }
}
