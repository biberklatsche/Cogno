import {
    Injectable,
    Injector,
    EnvironmentInjector,
    Type,
    createComponent,
    ComponentRef,
    DestroyRef
} from '@angular/core';
import {TerminalComponent} from "../../terminal/terminal.component";
import {TerminalId} from "../+model/model";
import {AppBus} from "../../app-bus/app-bus";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {TabRemovedEvent} from "../../tab-list/+bus/events";
import {ShellConfig, ShellConfigPosition} from "../../config/+models/config";

@Injectable({ providedIn: 'root' })
export class TerminalComponentFactory {
    private map = new Map<TerminalId, ComponentRef<TerminalComponent>>();

    constructor(private env: EnvironmentInjector, private injector: Injector) {

    }

    /** Returns the existing component for terminalId – or creates component exactly once */
    private getOrCreate(terminalId: TerminalId, shellConfig: ShellConfig): ComponentRef<TerminalComponent> {
        let ref = this.map.get(terminalId);
        if (!ref) {
            ref = createComponent(TerminalComponent as Type<TerminalComponent>, {
                environmentInjector: this.env,
                elementInjector: this.injector,
            });
            ref.setInput('terminalId', terminalId);
            ref.setInput('shellConfig', shellConfig);
            // one-time change detection for rendering
            ref.changeDetectorRef.detectChanges();
            this.map.set(terminalId, ref);
        }
        return ref;
    }

    getSnapshot(terminalId: TerminalId): string {
        const ref = this.map.get(terminalId);
        return ref?.instance.getTerminalSnapshot() ?? "";
    }

    attach(terminalId: TerminalId, shellConfig: ShellConfig, host: HTMLElement) {
        const ref = this.getOrCreate(terminalId, shellConfig);
        host.appendChild(ref.location.nativeElement); // reparent – no destroy/rebuild
        ref.changeDetectorRef.detectChanges();

    }

    /** Final close (Pane removed) */
    destroy(terminalId?: TerminalId) {
        if (!terminalId) return;
        const ref = this.map.get(terminalId);
        if (!ref) return;
        try {
            ref.destroy();
        } finally {
            this.map.delete(terminalId);
        }
    }
}
