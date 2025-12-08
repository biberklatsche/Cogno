import {Component, OnDestroy, OnInit, Signal} from '@angular/core';
import {
    InspectorService,
    MousePosition,
    TerminalMousePosition,
    TerminalCursorPosition
} from "../+state/inspector.service";
import {TerminalId} from "../../grid-list/+model/model";
import {TerminalDimensions} from "../../terminal/+state/handler/resize.handler";
import {Keybinding} from "../../config/+models/config.types";

@Component({
  selector: 'app-inspector-side',
  imports: [],
  templateUrl: './inspector-side.component.html',
  styleUrl: './inspector-side.component.scss'
})
export class InspectorSideComponent implements OnInit, OnDestroy {

    firedKeybinding: Signal<Keybinding | undefined>;
    mousePosition: Signal<MousePosition | undefined>;

    terminalIds: Signal<TerminalId[]>;
    terminalMouseById: Signal<Record<TerminalId, TerminalMousePosition>>;
    terminalCursorById: Signal<Record<TerminalId, TerminalCursorPosition>>;
    terminalDimsById: Signal<Record<TerminalId, TerminalDimensions>>;

    constructor(private inspectorService: InspectorService) {
        this.firedKeybinding = inspectorService.firedKeybinding;
        this.mousePosition = inspectorService.mousePosition;

        this.terminalIds = inspectorService.terminalIds;
        this.terminalMouseById = inspectorService.terminalMouseById;
        this.terminalCursorById = inspectorService.terminalCursorById;
        this.terminalDimsById = inspectorService.terminalDimsById;
    }

    ngOnDestroy(): void {
        this.inspectorService.dispose();
    }

    ngOnInit(): void {
        this.inspectorService.initView();
    }
}
