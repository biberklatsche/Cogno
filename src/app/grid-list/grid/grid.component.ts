import {Component, Input, Renderer2} from '@angular/core';
import {BinaryNode} from "../../common/tree/binary-tree";
import {Pane, SplitDirection} from "../+model/model";
import {NgStyle} from "@angular/common";
import {PaneComponent} from "../pane/pane.component";
import {ConfigService} from "../../config/+state/config.service";
import {ShellConfig} from "../../config/+models/config.types";

@Component({
  selector: 'app-grid',
    imports: [
        NgStyle,
        PaneComponent
    ],
  templateUrl: './grid.component.html',
  styleUrl: './grid.component.scss'
})
export class GridComponent {
    @Input({ required: true }) node!: BinaryNode<Pane>;


    styleForSplit(direction: SplitDirection, ratio: number = 0.5) {
        ratio = Math.max(0.05, Math.min(0.95, ratio));
        if (direction === 'vertical') {
            // links | divider | rechts
            return {
                gridTemplateColumns: `${ratio}fr 8px ${1 - ratio}fr`,
                gridTemplateRows: '1fr'
            };
        } else {
            // oben / divider / unten
            return {
                gridTemplateRows: `${ratio}fr 8px ${1 - ratio}fr`,
                gridTemplateColumns: '1fr'
            };
        }
    }

    private drag?: { node: BinaryNode<Pane>; startX: number; startY: number; startRatio: number; rect: DOMRect };

    startDragDivider(node: BinaryNode<Pane>, ev: MouseEvent) {
        const rect = (ev.currentTarget as HTMLElement).parentElement!.getBoundingClientRect();
        this.drag = { node, startX: ev.clientX, startY: ev.clientY, startRatio: node.data!.ratio ?? 0.5, rect };
        ev.preventDefault();
    }

    onDragDivider(ev: Event) {
        if (!this.drag) return;
        const mouseEvent = ev as MouseEvent;
        const { node, startX, startY, startRatio, rect } = this.drag;
        let r = startRatio;
        if (node.data!.splitDirection === 'vertical') r = startRatio + (mouseEvent.clientX - startX) / rect.width;
        else r = startRatio + (mouseEvent.clientY - startY) / rect.height;
        node.data!.ratio = Math.max(0.05, Math.min(0.95, r)); // **nur mutieren, nichts neu bauen**
    }

    stopDragDivider() { this.drag = undefined; }
}
