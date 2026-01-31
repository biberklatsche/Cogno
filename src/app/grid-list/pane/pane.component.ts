import {AfterViewInit, Component, ElementRef, input, ViewChild, effect, signal, computed} from '@angular/core';
import {TerminalComponentFactory} from "../+state/terminal-component.factory";
import {Pane, TerminalId} from "../+model/model";
import {ShellConfig} from "../../config/+models/config";
import {ConfigService} from "../../config/+state/config.service";
import {ShellProfile} from "../../config/+models/shell-config";
import {PromptProfile} from "../../config/+models/prompt-config";
import {PaneHeaderComponent} from "./pane-header.component";
import {GridListService} from "../+state/grid-list.service";
import {toSignal} from "@angular/core/rxjs-interop";
import {map} from "rxjs";

@Component({
  selector: 'app-pane',
  imports: [PaneHeaderComponent],
  template: `
      @if (showHeader()) {
        <app-pane-header [cwd]="cwd()"></app-pane-header>
      }
      <div #dock class="dock" [class.with-header]="showHeader()"></div>
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

  .dock.with-header {
      height: calc(100% - 24px);
  }
  `]
})
export class PaneComponent implements AfterViewInit {
    pane = input.required<Pane>();
    @ViewChild('dock', { static: true }) hostRef!: ElementRef<HTMLDivElement>;

    private _attachedTerminalId?: TerminalId;
    private _viewReady = signal(false);

    private activeGrid = toSignal(this._gridListService.grids$.pipe(
        map(grids => grids.find(g => g.tabId === this._gridListService['_activeTabId'].value))
    ));

    showHeader = computed(() => {
        const grid = this.activeGrid();
        if (!grid) return false;
        // Count leaf nodes (panes) in the tree
        const paneCount = grid.tree.find(node => node.isLeaf).length;
        return paneCount > 1;
    });

    cwd = computed(() => this.pane().workingDir || '');

    constructor(
        private _terminalComponents: TerminalComponentFactory,
        private _configService: ConfigService,
        private _gridListService: GridListService
    ) {
        // Create the effect within an injection context (constructor)
        effect(() => {
            // wait until view is ready so hostRef is available
            if (!this._viewReady()) return;
            const pane = this.pane();
            const id = pane.terminalId;
            const shellProfile = this.getShellProfile(pane);
            const promptProfile = this._configService.getPromptSegments();
            const host = this.hostRef?.nativeElement;
            if (!id || !host) return;
            if (this._attachedTerminalId !== id) {
                // Clear previous content to avoid multiple components in the dock
                while (host.firstChild) host.removeChild(host.firstChild);
                this._terminalComponents.attach(id, shellProfile, host);
                this._attachedTerminalId= id;
            }
        });
    }

    getShellProfile(pane: Pane): ShellProfile {
        const shellProfile = this._configService.getShellProfileOrDefault(pane.shellName);
        if(pane.workingDir) {
            shellProfile.working_dir = pane.workingDir;
        }
        return shellProfile;
    }

    ngAfterViewInit() {
        // mark view as ready to trigger the effect once the host is available
        this._viewReady.set(true);
    }
}

