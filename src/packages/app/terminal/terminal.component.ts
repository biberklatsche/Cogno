import {
    AfterViewInit,
    Component,
    DestroyRef,
    ElementRef,
    OnInit,
    ViewChild,
    input, ViewEncapsulation, ChangeDetectionStrategy, signal, Signal
} from '@angular/core';
import {TerminalSession} from "./+state/terminal.session";
import {TerminalHeaderComponent} from "./header/terminal-header.component";
import {TerminalId} from "../grid-list/+model/model";
import {ContextMenuOverlayService} from "../menu/context-menu-overlay/context-menu-overlay.service";
import { ContextMenuItem } from "../menu/context-menu-overlay/context-menu-overlay.types";
import {ShellProfile} from "../config/+models/shell-config";
import {TerminalStateManager} from "./+state/state";
import {toSignal} from "@angular/core/rxjs-interop";
import {TerminalCommandHistoryStore} from "./+state/advanced/history/terminal-command-history.store";
import {TerminalHistoryPersistenceService} from "./+state/advanced/history/terminal-history-persistence.service";
import {TerminalAutocompleteService} from "./+state/advanced/autocomplete/terminal-autocomplete.service";
import {TerminalAutocompleteComponent} from "./+state/advanced/autocomplete/terminal-autocomplete.component";
import { TerminalFileDropService } from "./terminal-file-drop.service";
import { IconComponent } from "@cogno/core-ui";
import { map } from "rxjs";

@Component({
    selector: 'app-terminal',
    templateUrl: './terminal.component.html',
    styleUrls: ['./terminal.component.scss'],
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        TerminalHeaderComponent,
        TerminalAutocompleteComponent,
        IconComponent,
    ],
    providers: [
        TerminalCommandHistoryStore,
        TerminalHistoryPersistenceService,
        TerminalAutocompleteService,
        TerminalFileDropService,
        TerminalSession,
        TerminalStateManager
    ],
    encapsulation: ViewEncapsulation.None
})
export class TerminalComponent implements OnInit, AfterViewInit {
    @ViewChild('terminalContainer', {static: true}) terminalContainer!: ElementRef<HTMLDivElement>;

    terminalId = input.required<TerminalId>();
    shellProfile = input.required<ShellProfile>();

    isFocused: Signal<boolean | undefined>;
    showScrollToBottomButton: Signal<boolean>;

    constructor(
        private destroyRef: DestroyRef,
        private menu: ContextMenuOverlayService,
        private terminalSession: TerminalSession,
        private terminalStateManager: TerminalStateManager,
        private terminalAutocomplete: TerminalAutocompleteService,
        private terminalFileDropService: TerminalFileDropService,
    ) {
        this.isFocused = toSignal(this.terminalStateManager.isFocused$);
        this.showScrollToBottomButton = toSignal(
            this.terminalStateManager.scrolledLinesFromBottom$.pipe(
                map((scrolledLinesFromBottom) => scrolledLinesFromBottom > 20),
            ),
            { initialValue: false },
        );
    }

    ngOnInit(): void {
        this.terminalSession.initialize(this.terminalId(), this.shellProfile());
        this.destroyRef.onDestroy(() => {
            this.terminalSession.dispose();
        });
    }

    ngAfterViewInit(): void {
        this.terminalAutocomplete.setHostElement(this.terminalContainer.nativeElement);
        this.terminalSession.initializeTerminal(this.terminalContainer.nativeElement);
        this.terminalFileDropService.initialize(this.terminalContainer.nativeElement);
    }

    onContextMenu(event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();
        this.terminalSession.focus();
        const items: ContextMenuItem[] = this.terminalSession.buildContextMenu();
        this.menu.openContextAt(event, { items });
    }

    focus(event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();
        this.terminalSession.focus();
    }

    scrollToBottom(event: MouseEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this.terminalSession.scrollToBottom();
    }
}


