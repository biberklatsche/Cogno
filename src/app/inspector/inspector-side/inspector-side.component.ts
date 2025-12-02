import {Component, OnDestroy, OnInit, Signal} from '@angular/core';
import {
    InspectorService,
    MousePosition,
    TerminalMousePosition,
    TerminalCursorPosition
} from "../+state/inspector.service";
import {Keybinding} from "../../keybinding/keybind.matcher";
import {TerminalId} from "../../grid-list/+model/model";
import {TerminalDimensions} from "../../terminal/+state/handler/resize.handler";
import {SideMenuItemComponent} from "../../menu/side-menu/+state/side-menu.service";

@Component({
  selector: 'app-inspector-side',
  imports: [],
  templateUrl: './inspector-side.component.html',
  styleUrl: './inspector-side.component.scss'
})
export class InspectorSideComponent implements OnInit, OnDestroy, SideMenuItemComponent {

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

    onSideMenuKey(event: KeyboardEvent): void {

    }

    ngOnDestroy(): void {
        this.inspectorService.dispose();
    }

    ngOnInit(): void {
        this.inspectorService.initView();
    }
}
