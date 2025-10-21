import {Injectable, Injector, EnvironmentInjector, Type, createComponent, ComponentRef} from '@angular/core';
import { DomPortal } from '@angular/cdk/portal';
import {TerminalComponent} from "../../../terminal/terminal.component";
import {TerminalId} from "../../+model/model";

@Injectable({ providedIn: 'root' })
export class TerminalPortalService {
    private map = new Map<TerminalId, ComponentRef<TerminalComponent>>();

    constructor(private env: EnvironmentInjector, private injector: Injector) {}

    /** Liefert den bestehenden Portal für paneId – oder erstellt Komponente + Portal genau 1x */
    getOrCreate(terminalId: TerminalId): ComponentRef<TerminalComponent> {
        let ref = this.map.get(terminalId);
        if (!ref) {
            ref = createComponent(TerminalComponent as Type<TerminalComponent>, {
                environmentInjector: this.env,
                elementInjector: this.injector,
            });
            // einmalige Change Detection zum Rendern
            ref.changeDetectorRef.detectChanges();
            this.map.set(terminalId, ref);
        }
        return ref;
    }

    attach(terminalId: TerminalId, host: HTMLElement) {
        const ref = this.getOrCreate(terminalId);
        host.appendChild(ref.location.nativeElement); // reparent – kein Destroy/Neuaufbau
        ref.changeDetectorRef.detectChanges();
    }

    /** Endgültig schließen (Pane entfernt) */
    destroy(terminalId: TerminalId) {
        const ref = this.map.get(terminalId);
        if (!ref) return;
        try {
            ref.destroy();
        } finally {
            this.map.delete(terminalId);
        }
    }
}
