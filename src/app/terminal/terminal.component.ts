import {
    AfterViewInit,
    Component,
    DestroyRef,
    ElementRef,
    OnInit,
    ViewChild,
    Input, input, ViewEncapsulation
} from '@angular/core';
import {TerminalSession} from "./+state/terminal.session";
import {ConfigService} from "../config/+state/config.service";
import {AppBus} from "../app-bus/app-bus";
import {TerminalId} from "../grid-list/+model/model";
import {ContextMenuOverlayService} from "../menu/context-menu-overlay/context-menu-overlay.service";
import { ContextMenuItem } from "../menu/context-menu-overlay/context-menu-overlay.types";
import {ShellConfig, ShellConfigPosition} from "../config/+models/config";

@Component({
    selector: 'app-terminal',
    templateUrl: './terminal.component.html',
    styleUrls: ['./terminal.component.scss'],
    standalone: true,
    encapsulation: ViewEncapsulation.None
})
export class TerminalComponent implements OnInit, AfterViewInit {
    @ViewChild('terminalContainer', {static: true}) terminalContainer!: ElementRef<HTMLDivElement>;
    private terminalSession?: TerminalSession;
    terminalId = input.required<TerminalId>();
    shellConfig = input.required<ShellConfig>();

    constructor(private configService: ConfigService, private bus: AppBus, private destroyRef: DestroyRef, private menu: ContextMenuOverlayService) {
    }

    ngOnInit(): void {
        this.terminalSession = new TerminalSession(this.configService, this.bus, this.terminalId(), this.shellConfig());
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

    getTerminalSnapshot(): string {
        return "";
    }

    protected readonly eval = eval;
}
