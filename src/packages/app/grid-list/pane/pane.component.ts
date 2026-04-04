import {AfterViewInit, Component, ElementRef, input, ViewChild, effect, signal, computed} from '@angular/core';
import {TerminalComponentFactory} from "../+state/terminal-component.factory";
import {Pane, TerminalId} from "../+model/model";
import {ConfigService} from "../../config/+state/config.service";
import {ShellProfile} from "../../config/+models/shell-config";
import {PaneHeaderComponent} from "./pane-header.component";
import {GridListService} from "../+state/grid-list.service";
import {toSignal} from "@angular/core/rxjs-interop";

@Component({
  selector: 'app-pane',
  imports: [PaneHeaderComponent],
  host: {
      '(mouseenter)': 'updatePaneSwapTarget()',
      '[class.is-maximized]': 'isMaximizedPane()',
      '[class.is-hidden-during-maximize]': 'isHiddenDuringMaximize()'
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

  :host.is-maximized {
      position: absolute;
      inset: 0;
      z-index: 20;
      background: color-mix(in srgb, var(--background-color) 50%, transparent);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
  }

  :host.is-hidden-during-maximize {
      visibility: hidden;
      pointer-events: none;
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
    private maximizedTerminalId = toSignal(this.gridListService.maximizedTerminalId$, { initialValue: undefined });

    cwd = computed(() => this.pane().workingDir || '');
    isMaximizedPane = computed(() => this.maximizedTerminalId() === this.pane().terminalId);
    isHiddenDuringMaximize = computed(() => {
        const maximizedTerminalId = this.maximizedTerminalId();
        return !!maximizedTerminalId && maximizedTerminalId !== this.pane().terminalId;
    });

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


