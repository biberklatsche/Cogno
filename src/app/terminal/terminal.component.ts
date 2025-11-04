import {AfterViewInit, Component, DestroyRef, ElementRef, input, OnInit, ViewChild} from '@angular/core';
import {TerminalSession} from "./+state/terminal.session";
import {ConfigService} from "../config/+state/config.service";
import {AppBus} from "../app-bus/app-bus";
import {TerminalId} from "../grid-list/+model/model";
import {MenuOverlayService} from "../common/menu-overlay/menu-overlay.service";
import { ContextMenuComponent } from "../common/menu-overlay/context-menu.component";
import { ContextMenuItem } from "../common/menu-overlay/menu-overlay.types";

@Component({
    selector: 'app-terminal',
    templateUrl: './terminal.component.html',
    styleUrls: ['./terminal.component.scss'],
    standalone: true
})
export class TerminalComponent implements OnInit, AfterViewInit {
    @ViewChild('terminalContainer', {static: true}) terminalContainer!: ElementRef<HTMLDivElement>;
    private terminalSession?: TerminalSession;
    terminalId= input.required<TerminalId>();

    constructor(private configService: ConfigService, private bus: AppBus, private destroyRef: DestroyRef, private menu: MenuOverlayService) {
    }

    ngOnInit(): void {
        this.terminalSession = new TerminalSession(this.configService, this.bus, this.terminalId());
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
        const items: ContextMenuItem[] = this.terminalSession?.buildContextMenu() ?? [];
        this.menu.openAt(event, ContextMenuComponent, { items });
    }

    focus(event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();
        this.terminalSession?.focus();
    }

    protected readonly eval = eval;
}
