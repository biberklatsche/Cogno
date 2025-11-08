import {Component, Signal} from '@angular/core';
import {InspectorService, MousePosition} from "../../+state/inspector.service";
import {AppBus} from "../../../app-bus/app-bus";
import {Keybinding} from "../../../keybinding/keybind.matcher";

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

    constructor(inspectorService: InspectorService) {
        this.firedKeybinding = inspectorService.firedKeybinding;
        this.mousePosition = inspectorService.mousePosition;
    }
}
