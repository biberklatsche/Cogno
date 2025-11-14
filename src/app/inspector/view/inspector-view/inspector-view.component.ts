import {Component, Signal} from '@angular/core';
import {
    InspectorService,
    MousePosition,
    TerminalMousePosition,
    TerminalCursorPosition
} from "../../+state/inspector.service";
import {Keybinding} from "../../../keybinding/keybind.matcher";
import {TerminalId} from "../../../grid-list/+model/model";
import {TerminalDimensions} from "../../../terminal/+state/handler/resize.handler";

@Component({
  selector: 'app-inspector-view',
  imports: [],
  templateUrl: './inspector-view.component.html',
  styleUrl: './inspector-view.component.scss',
  providers: [InspectorService]
})
export class InspectorViewComponent {

    firedKeybinding: Signal<Keybinding | undefined>;
    mousePosition: Signal<MousePosition | undefined>;

    terminalIds: Signal<TerminalId[]>;
    terminalMouseById: Signal<Record<TerminalId, TerminalMousePosition>>;
    terminalCursorById: Signal<Record<TerminalId, TerminalCursorPosition>>;
    terminalDimsById: Signal<Record<TerminalId, TerminalDimensions>>;

    constructor(inspectorService: InspectorService) {
        this.firedKeybinding = inspectorService.firedKeybinding;
        this.mousePosition = inspectorService.mousePosition;

        this.terminalIds = inspectorService.terminalIds;
        this.terminalMouseById = inspectorService.terminalMouseById;
        this.terminalCursorById = inspectorService.terminalCursorById;
        this.terminalDimsById = inspectorService.terminalDimsById;
    }
}
