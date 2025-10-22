import {AfterViewInit, Component, DestroyRef, ElementRef, ViewChild} from '@angular/core';
import {TerminalSession} from "./+state/terminal.session";
import {ConfigService} from "../config/+state/config.service";



@Component({
    selector: 'app-terminal',
    templateUrl: './terminal.component.html',
    styleUrls: ['./terminal.component.scss'],
    standalone: true
})
export class TerminalComponent implements AfterViewInit {
    @ViewChild('terminalContainer', {static: true}) terminalContainer!: ElementRef<HTMLDivElement>;
    private terminalSession?: TerminalSession;

    constructor(configService: ConfigService, destroyRef: DestroyRef) {
        this.terminalSession = new TerminalSession(configService);
        destroyRef.onDestroy(() => {
            console.log('destroy terminal!!!!!!!');
           this.terminalSession?.dispose();
        });
    }

    ngAfterViewInit(): void {
        this.terminalSession?.bindRenderer(this.terminalContainer.nativeElement);
    }
}
