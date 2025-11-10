import {
    AfterViewInit,
    Component,
    DestroyRef,
    ElementRef,
    OnInit,
    ViewChild,
    Input
} from '@angular/core';
import {TerminalSession} from "./+state/terminal.session";
import {ConfigService} from "../config/+state/config.service";
import {AppBus} from "../app-bus/app-bus";
import {TerminalId} from "../grid-list/+model/model";
import {MenuOverlayService} from "../common/menu-overlay/menu-overlay.service";
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
    private _terminalId!: TerminalId;

    @Input({ required: true })
    set terminalId(value: TerminalId) {
        if(!this._terminalId) this._terminalId = value;
    }

    get terminalId(): TerminalId {
        return this._terminalId;
    }

    constructor(private configService: ConfigService, private bus: AppBus, private destroyRef: DestroyRef, private menu: MenuOverlayService) {
    }

    ngOnInit(): void {
        this.terminalSession = new TerminalSession(this.configService, this.bus, this.terminalId);
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

    protected readonly eval = eval;
}
