import {AfterViewInit, Component, ElementRef, input, ViewChild, effect, signal} from '@angular/core';
import {TerminalComponentFactory} from "../+state/terminal-component.factory";
import {Pane, TerminalId} from "../+model/model";
import {ShellConfig, ShellConfigPosition} from "../../config/+models/config.types";
import {ConfigService} from "../../config/+state/config.service";

@Component({
  selector: 'app-pane',
  imports: [],
  template: `
      <div #dock class="dock"></div>
  `,
  styles: [`:host{
      display:block;
      height:100%;
      width:100%;
  }

  .dock {
      height:100%;
      width:100%;
      min-height: 0;
      min-width: 0;
  }
  `]
})
export class PaneComponent implements AfterViewInit {
    pane = input.required<Pane>();
    @ViewChild('dock', { static: true }) hostRef!: ElementRef<HTMLDivElement>;

    private _attachedTerminalId?: TerminalId;
    private _viewReady = signal(false);

    constructor(private _terminalComponents: TerminalComponentFactory, private _configService: ConfigService) {
        // Create the effect within an injection context (constructor)
        effect(() => {
            // wait until view is ready so hostRef is available
            if (!this._viewReady()) return;
            const pane = this.pane();
            const id = pane.terminalId;
            const shellConfig = this.getShellConfig(pane);
            const host = this.hostRef?.nativeElement;
            if (!id || !host) return;
            if (this._attachedTerminalId !== id) {
                // Clear previous content to avoid multiple components in the dock
                while (host.firstChild) host.removeChild(host.firstChild);
                this._terminalComponents.attach(id, shellConfig, host);
                this._attachedTerminalId= id;
            }
        });
    }

    getShellConfig(pane: Pane): ShellConfig {
        if(!pane.shellConfigPosition) throw new Error('Invalid shell config position');
        const shellConfig = this._configService.getShellConfigOrDefault(pane.shellConfigPosition);
        if(pane.workingDir) {
            shellConfig.working_dir = pane.workingDir;
        }
        return shellConfig;
    }

    ngAfterViewInit() {
        // mark view as ready to trigger the effect once the host is available
        this._viewReady.set(true);
    }
}

