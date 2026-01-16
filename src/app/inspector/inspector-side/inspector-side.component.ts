import {Component, OnDestroy, OnInit, Signal} from '@angular/core';
import {
    InspectorService,
    GlobalMousePosition,
} from "../+state/inspector.service";
import {TerminalId} from "../../grid-list/+model/model";
import {TerminalDimensions} from "../../terminal/+state/handler/resize.handler";
import {Keybinding} from "../../config/+models/config";
import {TerminalCursorPosition, TerminalMousePosition} from "../../terminal/+state/session.state";

@Component({
  selector: 'app-inspector-side',
  imports: [],
  templateUrl: './inspector-side.component.html',
  styleUrl: './inspector-side.component.scss'
})
export class InspectorSideComponent {

    firedKeybinding: Signal<Keybinding | undefined>;
    globalMousePosition: Signal<GlobalMousePosition | undefined>;

    terminalIds: Signal<TerminalId[]>;
    terminalMouseById: Signal<Record<TerminalId, TerminalMousePosition>>;
    terminalCursorById: Signal<Record<TerminalId, TerminalCursorPosition>>;
    terminalInputById: Signal<Record<TerminalId, string>>;
    terminalDimsById: Signal<Record<TerminalId, TerminalDimensions>>;

    constructor(inspectorService: InspectorService) {
        this.firedKeybinding = inspectorService.firedKeybinding;
        this.globalMousePosition = inspectorService.globalMousePosition;

        this.terminalIds = inspectorService.terminalIds;
        this.terminalMouseById = inspectorService.terminalMouseById;
        this.terminalCursorById = inspectorService.terminalCursorById;
        this.terminalDimsById = inspectorService.terminalDimsById;
        this.terminalInputById = inspectorService.terminalInputById;
    }
}
