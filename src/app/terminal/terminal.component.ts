import {
    AfterViewInit,
    Component,
    DestroyRef,
    ElementRef,
    OnInit,
    ViewChild,
    input, ViewEncapsulation, ChangeDetectionStrategy
} from '@angular/core';
import {TerminalSession} from "./+state/terminal.session";
import {TerminalHeaderComponent} from "./header/terminal-header.component";
import {TerminalId} from "../grid-list/+model/model";
import {ContextMenuOverlayService} from "../menu/context-menu-overlay/context-menu-overlay.service";
import { ContextMenuItem } from "../menu/context-menu-overlay/context-menu-overlay.types";
import {ShellProfile} from "../config/+models/shell-config";
import {TerminalStateManager} from "./+state/state";

@Component({
    selector: 'app-terminal',
    templateUrl: './terminal.component.html',
    styleUrls: ['./terminal.component.scss'],
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        TerminalHeaderComponent
    ],
    providers: [
        TerminalSession,
        TerminalStateManager
    ],
    encapsulation: ViewEncapsulation.None
})
export class TerminalComponent implements OnInit, AfterViewInit {
    @ViewChild('terminalContainer', {static: true}) terminalContainer!: ElementRef<HTMLDivElement>;

    terminalId = input.required<TerminalId>();
    shellProfile = input.required<ShellProfile>();

    constructor(
        private destroyRef: DestroyRef,
        private menu: ContextMenuOverlayService,
        private terminalSession: TerminalSession
    ) {
    }

    ngOnInit(): void {
        this.terminalSession.initialize(this.terminalId(), this.shellProfile());
        this.destroyRef.onDestroy(() => {
            this.terminalSession.dispose();
        });
    }

    ngAfterViewInit(): void {
        this.terminalSession.initializeTerminal(this.terminalContainer.nativeElement);
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
}
