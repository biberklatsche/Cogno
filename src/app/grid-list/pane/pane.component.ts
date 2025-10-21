import {AfterViewInit, Component, ElementRef, Input, ViewChild} from '@angular/core';
import {ShellConfigPosition} from "../../config/+models/config";
import {TerminalPortalService} from "./+state/terminal-portal.service";
import {TerminalId} from "../+model/model";

@Component({
  selector: 'app-pane',
  imports: [],
  templateUrl: './pane.component.html',
  styleUrl: './pane.component.scss'
})
export class PaneComponent implements AfterViewInit {
    @Input({ required: true }) terminalId!: TerminalId;
    //@Input({ required: true }) shellConfigPosition!: ShellConfigPosition;

    @ViewChild('dock', { static: true }) hostRef!: ElementRef<HTMLDivElement>;


    constructor(private terminals: TerminalPortalService) {}

    ngAfterViewInit() {
        this.terminals.attach(this.terminalId, this.hostRef.nativeElement);
    }
}

