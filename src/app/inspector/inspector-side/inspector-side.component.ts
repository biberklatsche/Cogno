import {Component, Signal} from '@angular/core';
import {
    InspectorService,
    GlobalMousePosition,
} from "../+state/inspector.service";
import {TerminalId} from "../../grid-list/+model/model";
import {Keybinding} from "../../config/+models/config";
import {TerminalState, Command} from '../../terminal/+state/state';
import {TooltipDirective} from "../../common/tooltip/tooltip.directive";

@Component({
  selector: 'app-inspector-side',
    imports: [
        TooltipDirective
    ],
  templateUrl: './inspector-side.component.html',
  styleUrl: './inspector-side.component.scss'
})
export class InspectorSideComponent {

    firedKeybinding: Signal<Keybinding | undefined>;
    globalMousePosition: Signal<GlobalMousePosition | undefined>;

    terminalIds: Signal<TerminalId[]>;
    terminalStateById: Signal<Record<TerminalId, TerminalState>>;
    terminalHistoryById: Signal<Record<TerminalId, Command[]>>;

    constructor(inspectorService: InspectorService) {
        this.firedKeybinding = inspectorService.firedKeybinding;
        this.globalMousePosition = inspectorService.globalMousePosition;
        this.terminalIds = inspectorService.terminalIds;
        this.terminalStateById = inspectorService.terminalStateById;
        this.terminalHistoryById = inspectorService.terminalHistoryById;
    }
}
