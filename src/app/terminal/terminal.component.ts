import {
    AfterViewInit,
    Component,
    DestroyRef,
    ElementRef,
    OnInit,
    ViewChild,
    input, ViewEncapsulation, signal, ChangeDetectorRef, WritableSignal, ChangeDetectionStrategy, ApplicationRef
} from '@angular/core';
import {TerminalSession} from "./+state/terminal.session";
import {TerminalHeaderComponent} from "./header/terminal-header.component";
import {ConfigService} from "../config/+state/config.service";
import {AppBus} from "../app-bus/app-bus";
import {TerminalId} from "../grid-list/+model/model";
import {ContextMenuOverlayService} from "../menu/context-menu-overlay/context-menu-overlay.service";
import { ContextMenuItem } from "../menu/context-menu-overlay/context-menu-overlay.types";
import {ShellConfig} from "../config/+models/config";
import {ShellProfile} from "../config/+models/shell-config";
import {PromptProfile} from "../config/+models/prompt-config";
import {INITIAL_STATE, TerminalState} from "./state";
import {takeUntilDestroyed, toSignal} from "@angular/core/rxjs-interop";
import {AsyncPipe, JsonPipe} from "@angular/common";
import {animationFrameScheduler, auditTime, debounceTime, Observable, Subject, switchMap, tap} from "rxjs";

@Component({
    selector: 'app-terminal',
    templateUrl: './terminal.component.html',
    styleUrls: ['./terminal.component.scss'],
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        TerminalHeaderComponent
    ],
    encapsulation: ViewEncapsulation.None
})
export class TerminalComponent implements OnInit, AfterViewInit {
    @ViewChild('terminalContainer', {static: true}) terminalContainer!: ElementRef<HTMLDivElement>;
    // Ein Subject, das wir füttern, sobald die Session bereit ist
    private terminalSession?: TerminalSession;
    private sessionReady$ = new Subject<TerminalSession>();

    // Wir definieren das Signal direkt hier oben (Injection Context)
    readonly terminalState = toSignal(
        this.sessionReady$.pipe(
            // Sobald die Session da ist, verbinden wir uns mit ihrem state$
            switchMap(session => {
                return session.state$
            }),
            auditTime(0, animationFrameScheduler),
            tap(() => {
                this.ch.detectChanges();
            })
        ),
        { initialValue: INITIAL_STATE }
    );

    // Wir definieren das Signal direkt hier oben (Injection Context)
    readonly history = toSignal(
        this.sessionReady$.pipe(
            // Sobald die Session da ist, verbinden wir uns mit ihrem state$
            switchMap(session => {
                return session.history$
            }),
            auditTime(0, animationFrameScheduler),
            tap(() => {
                this.ch.detectChanges();
            })
        ),
        { initialValue: [] }
    );


    terminalId = input.required<TerminalId>();
    shellProfile = input.required<ShellProfile>();

    constructor(private configService: ConfigService, private bus: AppBus, private destroyRef: DestroyRef, private ch: ChangeDetectorRef, private menu: ContextMenuOverlayService) {
    }

    ngOnInit(): void {
        this.terminalSession = new TerminalSession(this.configService, this.bus, this.terminalId(), this.shellProfile());
        // State Observable in Signal überführen
        this.sessionReady$.next(this.terminalSession);
        this.destroyRef.onDestroy(() => {
            this.terminalSession?.dispose();
        });
    }

    ngAfterViewInit(): void {
        this.terminalSession?.initializeTerminal(this.terminalContainer.nativeElement);
    }

    onContextMenu(event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();
        this.terminalSession?.focus();
        const items: ContextMenuItem[] = this.terminalSession?.buildContextMenu() ?? [];
        this.menu.openContextAt(event, { items });
    }

    focus(event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();
        this.terminalSession?.focus();
    }
}
