import {AfterViewInit, Component, ElementRef, input, ViewChild, effect, signal, computed} from '@angular/core';
import {TerminalComponentFactory} from "../+state/terminal-component.factory";
import {Pane, TerminalId} from "../+model/model";
import {ConfigService} from "../../config/+state/config.service";
import {ShellProfile} from "../../config/+models/shell-config";
import {PaneHeaderComponent} from "./pane-header.component";
import {GridListService} from "../+state/grid-list.service";

@Component({
  selector: 'app-pane',
  imports: [PaneHeaderComponent],
  host: {
      '(mouseenter)': 'updatePaneSwapTarget()'
  },
  template: `
      @if (pane().terminalId) {
          <app-pane-header [cwd]="cwd()" [terminalId]="pane().terminalId!"></app-pane-header>
      }
      <div #dock class="dock"></div>
  `,
  styles: [`:host{
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
  }

  .dock {
      flex: 1;
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

    cwd = computed(() => this.pane().workingDir || '');

    constructor(
        private _terminalComponents: TerminalComponentFactory,
        private _configService: ConfigService,
        private gridListService: GridListService
    ) {
        // Create the effect within an injection context (constructor)
        effect(() => {
            if (!this._viewReady()) return;
            const pane = this.pane();
            const id = pane.terminalId;
            const shellProfile = this.getShellProfile(pane);
            const host = this.hostRef?.nativeElement;
            if (!id || !host) return;
            if (this._attachedTerminalId !== id) {
                while (host.firstChild) host.removeChild(host.firstChild);
                this._terminalComponents.attach(id, shellProfile, host);
                this._attachedTerminalId = id;
            }
        });
    }

    private getShellProfile(pane: Pane): ShellProfile {
        const shellProfile = this._configService.getShellProfileOrDefault(pane.shellName);
        if (pane.workingDir) {
            shellProfile.working_dir = pane.workingDir;
        }
        return shellProfile;
    }

    ngAfterViewInit() {
        this._viewReady.set(true);
    }

    updatePaneSwapTarget(): void {
        if (!this.gridListService.isPaneSwapDragActive()) return;
        const terminalId = this.pane().terminalId;
        if (!terminalId) return;
        this.gridListService.updatePaneSwapTarget(terminalId);
    }
}
