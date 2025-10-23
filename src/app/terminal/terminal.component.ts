import {AfterViewInit, Component, DestroyRef, ElementRef, input, Input, OnInit, ViewChild} from '@angular/core';
import {TerminalSession} from "./+state/terminal.session";
import {ConfigService} from "../config/+state/config.service";
import {AppBus} from "../app-bus/app-bus";
import {TerminalId} from "../grid-list/+model/model";

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

    constructor(private configService: ConfigService, private bus: AppBus, private destroyRef: DestroyRef) {
    }

    ngOnInit(): void {
        this.terminalSession = new TerminalSession(this.configService, this.bus, this.terminalId());
        this.destroyRef.onDestroy(() => {
            console.log('#######destro!!!!')
            this.terminalSession?.dispose();
        });
    }

    ngAfterViewInit(): void {
        this.terminalSession?.bindRenderer(this.terminalContainer.nativeElement);
    }
}
