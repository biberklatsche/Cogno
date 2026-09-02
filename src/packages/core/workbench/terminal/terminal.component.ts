import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Signal,
  ViewChild,
  ViewEncapsulation,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { TerminalAutocompleteComponent } from "@cogno/core/session/autocomplete/terminal-autocomplete.component";
import { TerminalAutocompleteService } from "@cogno/core/session/autocomplete/terminal-autocomplete.service";
import { TerminalComposerComponent } from "@cogno/core/session/composer/terminal-composer.component";
import { TerminalComposerService } from "@cogno/core/session/composer/terminal-composer.service";
import { TerminalHistoryComponent } from "@cogno/core/session/history/terminal-history.component";
import { TerminalHistoryService } from "@cogno/core/session/history/terminal-history.service";
import { SessionHost, SessionRuntime } from "@cogno/core/session/host/session-host";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { ContextMenuItem, ContextMenuOverlayService, IconComponent } from "@cogno/shared/ui";
import { map } from "rxjs";
import { SessionMenus } from "./+state/session-menus";
import { TerminalHeaderComponent } from "./header/terminal-header.component";
import { TerminalFileDropService } from "./terminal-file-drop.service";

/**
 * The pane's view of a session. The session itself - host, bridge, menus,
 * dropdown services - is created and started by SessionHostFactory
 * before this view exists and outlives it; this only attaches the machine
 * to its element, shows a failed start, and detaches on destroy.
 */
@Component({
  selector: "app-terminal",
  templateUrl: "./terminal.component.html",
  styleUrls: ["./terminal.component.scss"],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TerminalHeaderComponent,
    TerminalAutocompleteComponent,
    TerminalComposerComponent,
    TerminalHistoryComponent,
    IconComponent,
  ],
  encapsulation: ViewEncapsulation.None,
})
export class TerminalComponent implements AfterViewInit {
  @ViewChild("terminalContainer", { static: true }) terminalContainer!: ElementRef<HTMLDivElement>;

  isFocused: Signal<boolean | undefined>;
  isInFullScreenMode: Signal<boolean | undefined>;
  showScrollToBottomButton: Signal<boolean>;
  isWebglContextLost: Signal<boolean>;
  runtime: Signal<SessionRuntime>;

  constructor(
    destroyRef: DestroyRef,
    private menu: ContextMenuOverlayService,
    private bus: AppBus,
    private host: SessionHost,
    private menus: SessionMenus,
    private terminalAutocomplete: TerminalAutocompleteService,
    private terminalComposer: TerminalComposerService,
    private terminalHistory: TerminalHistoryService,
    private terminalFileDropService: TerminalFileDropService,
  ) {
    this.isFocused = toSignal(this.host.machine.isFocused$);
    this.isInFullScreenMode = toSignal(this.host.machine.isInFullScreenMode$);
    this.showScrollToBottomButton = toSignal(
      this.host.machine.scrolledLinesFromBottom$.pipe(
        map((scrolledLinesFromBottom) => scrolledLinesFromBottom > 20),
      ),
      { initialValue: false },
    );
    this.isWebglContextLost = toSignal(this.host.isWebglContextLost$, { initialValue: false });
    this.runtime = toSignal(this.host.runtime$, { initialValue: this.host.runtime });
    // The view goes, the session stays: closing is the factory's decision.
    destroyRef.onDestroy(() => this.host.detach());
  }

  ngAfterViewInit(): void {
    const container = this.terminalContainer.nativeElement;
    this.terminalAutocomplete.setHostElement(container);
    this.terminalComposer.setHostElement(container);
    this.terminalHistory.setHostElement(container);
    this.host.attach(container);
    this.terminalFileDropService.initialize(container);
  }

  onContextMenu(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.host.focus();
    const items: ContextMenuItem[] = this.menus.buildContextMenu();
    this.menu.openAtPoint(event, { items });
  }

  focus(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.host.focus();
  }

  scrollToBottom(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.host.scrollToBottom();
  }

  /** The shell did not start: try again with the same profile. */
  retry(): void {
    this.host.retry();
  }

  /** The shell did not start: give the pane up. */
  closeAfterFailure(): void {
    const terminalId = this.host.terminalId;
    if (!terminalId) return;
    this.bus.publish({ path: ["app", "terminal"], type: "RemovePane", payload: terminalId });
  }
}
