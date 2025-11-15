import {Component, DestroyRef, signal, WritableSignal} from '@angular/core';
import {KeybindService} from "../keybinding/keybind.service";
import {Subscription} from "rxjs";
import {AppBus} from "../app-bus/app-bus";
import {InspectorViewComponent} from "./view/inspector-view/inspector-view.component";
import {InspectorService} from "./+state/inspector.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";

@Component({
  selector: 'app-inspector',
    imports: [
        InspectorViewComponent
    ],
  templateUrl: './inspector.component.html',
  styleUrl: './inspector.component.scss',
})
export class InspectorComponent {
    showInspector: WritableSignal<boolean> = signal<boolean>(false);

    constructor(bus: AppBus, ref: DestroyRef) {
        bus.on$({type: 'ActionFired', path: ['app', 'action']}).pipe(takeUntilDestroyed(ref)).subscribe(event => {
            switch (event.payload) {
                case 'toggle_inspector': {
                    this.showInspector.update((current) => !current);
                    break;
                }
            }
        });
    }
}
