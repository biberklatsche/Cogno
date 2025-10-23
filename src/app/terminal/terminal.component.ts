import {AfterViewInit, Component, DestroyRef, ElementRef, Input, ViewChild} from '@angular/core';
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
export class TerminalComponent implements AfterViewInit {
    @ViewChild('terminalContainer', {static: true}) terminalContainer!: ElementRef<HTMLDivElement>;
    private terminalSession?: TerminalSession;
    @Input({required: true}) terminalId!: TerminalId;

    constructor(configService: ConfigService, bus: AppBus, destroyRef: DestroyRef) {
        this.terminalSession = new TerminalSession(configService, bus, this.terminalId);
        destroyRef.onDestroy(() => {
            console.log('destroy terminal!!!!!!!');
           this.terminalSession?.dispose();
        });
    }

    ngAfterViewInit(): void {
        this.terminalSession?.bindRenderer(this.terminalContainer.nativeElement);
    }
}
