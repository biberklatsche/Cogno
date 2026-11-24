import {
  AfterViewInit,
  Component,
  computed,
  ElementRef,
  effect,
  input,
  signal,
  ViewChild,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { SessionHostFactory } from "@cogno/core/workbench/grid-list/+state/session-host-factory";
import { TerminalId } from "@cogno/shared/domain";
import { Pane } from "../+model/model";
import { GridListService } from "../+state/grid-list.service";
import { PaneHeaderComponent } from "./pane-header.component";

@Component({
  selector: "app-pane",
  imports: [PaneHeaderComponent],
  host: {
    "(mouseenter)": "updatePaneSwapTarget()",
    "[class.is-maximized]": "isMaximizedPane()",
    "[class.is-hidden-during-maximize]": "isHiddenDuringMaximize()",
  },
  template: `
      @if (pane().terminalId) {
          <app-pane-header [title]="title()" [terminalId]="pane().terminalId!"></app-pane-header>
      }
      <div #dock class="dock"></div>
  `,
  styles: [
    `:host{
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
  }

  /* A maximized pane looks like an expanded side panel (side-menu.component):
     an opaque surface with the same edge and offsets, over the other panes
     of the tab but not over the pinned panels beside them. */
  :host.is-maximized {
      position: absolute;
      top: 2px;
      bottom: 4px;
      left: 4px;
      right: 4px;
      width: auto;
      height: auto;
      z-index: 20;
      padding: 6px;
      border: 1px solid color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
      border-radius: 6px;
      background-color: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-1)), var(--background-color));
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
  `,
  ],
})
export class PaneComponent implements AfterViewInit {
  pane = input.required<Pane>();
  @ViewChild("dock", { static: true }) hostRef!: ElementRef<HTMLDivElement>;

  private _attachedTerminalId?: TerminalId;
  private _viewReady = signal(false);
  private maximizedTerminalId = toSignal(this.gridListService.maximizedTerminalId$, {
    initialValue: undefined,
  });

  title = computed(() => this.pane().title ?? this.pane().workingDir ?? "");
  isMaximizedPane = computed(() => this.maximizedTerminalId() === this.pane().terminalId);
  isHiddenDuringMaximize = computed(() => {
    const maximizedTerminalId = this.maximizedTerminalId();
    return !!maximizedTerminalId && maximizedTerminalId !== this.pane().terminalId;
  });

  constructor(
    private _terminalComponents: SessionHostFactory,
    private gridListService: GridListService,
  ) {
    // Create the effect within an injection context (constructor)
    effect(() => {
      if (!this._viewReady()) return;
      const pane = this.pane();
      const id = pane.terminalId;
      const mountPoint = this.hostRef?.nativeElement;
      if (!id || !mountPoint) return;
      if (this._attachedTerminalId !== id) {
        while (mountPoint.firstChild) mountPoint.removeChild(mountPoint.firstChild);
        this._terminalComponents.mount(pane, mountPoint);
        this._attachedTerminalId = id;
      }
    });
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
