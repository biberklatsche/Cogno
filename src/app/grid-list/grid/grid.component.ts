import {Component, Input} from '@angular/core';
import {BinaryNode} from "../../common/tree/binary-tree";
import {Pane, SplitDirection} from "../+model/model";
import {JsonPipe, NgStyle} from "@angular/common";
import {PaneComponent} from "../pane/pane.component";

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
                gridTemplateColumns: `${ratio}fr 6px ${1 - ratio}fr`,
                gridTemplateRows: '1fr'
            };
        } else {
            // oben / divider / unten
            return {
                gridTemplateRows: `${ratio}fr 6px ${1 - ratio}fr`,
                gridTemplateColumns: '1fr'
            };
        }
    }

}
