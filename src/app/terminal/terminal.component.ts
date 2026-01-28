import {
    AfterViewInit,
    Component,
    DestroyRef,
    ElementRef,
    OnInit,
    ViewChild,
    input, ViewEncapsulation, ChangeDetectorRef, ChangeDetectionStrategy
} from '@angular/core';
import {TerminalSession} from "./+state/terminal.session";
import {TerminalHeaderComponent} from "./header/terminal-header.component";
import {AppBus} from "../app-bus/app-bus";
import {TerminalId} from "../grid-list/+model/model";
import {ContextMenuOverlayService} from "../menu/context-menu-overlay/context-menu-overlay.service";
import { ContextMenuItem } from "../menu/context-menu-overlay/context-menu-overlay.types";
import {ShellProfile} from "../config/+models/shell-config";
import {INITIAL_STATE, TerminalStateManager} from "./state";
import {toSignal} from "@angular/core/rxjs-interop";
import {animationFrameScheduler, auditTime, tap} from "rxjs";

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

    readonly terminalState = toSignal(
        this.stateManager.state$.pipe(
            auditTime(0, animationFrameScheduler),
            tap(() => {
                this.ch.detectChanges();
            })
        ),
        { initialValue: INITIAL_STATE }
    );

    readonly history = toSignal(
        this.stateManager.commands$.pipe(
            auditTime(0, animationFrameScheduler),
            tap(() => {
                this.ch.detectChanges();
            })
        ),
        { initialValue: [] }
    );


    terminalId = input.required<TerminalId>();
    shellProfile = input.required<ShellProfile>();

    constructor(
        private destroyRef: DestroyRef,
        private ch: ChangeDetectorRef,
        private menu: ContextMenuOverlayService,
        private terminalSession: TerminalSession,
        private stateManager: TerminalStateManager
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
