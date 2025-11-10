import {AfterViewInit, Component, ElementRef, input, ViewChild, effect, signal} from '@angular/core';
import {TerminalComponentFactory} from "../+state/terminal-component.factory";
import {TerminalId} from "../+model/model";

@Component({
  selector: 'app-pane',
  imports: [],
  templateUrl: './pane.component.html',
  styleUrl: './pane.component.scss'
})
export class PaneComponent implements AfterViewInit {
    terminalId = input.required<TerminalId>();
    @ViewChild('dock', { static: true }) hostRef!: ElementRef<HTMLDivElement>;

    private _attachedTerminalId?: TerminalId;
    private _viewReady = signal(false);

    constructor(private terminalComponents: TerminalComponentFactory) {
        // Create the effect within an injection context (constructor)
        effect(() => {
            // wait until view is ready so hostRef is available
            if (!this._viewReady()) return;
            const id = this.terminalId();
            const host = this.hostRef?.nativeElement;
            if (!id || !host) return;
            if (this._attachedTerminalId !== id) {
                // Clear previous content to avoid multiple components in the dock
                while (host.firstChild) host.removeChild(host.firstChild);
                this.terminalComponents.attach(id, host);
                this._attachedTerminalId= id;
            }
        });
    }

    ngAfterViewInit() {
        // mark view as ready to trigger the effect once the host is available
        this._viewReady.set(true);
    }
}

