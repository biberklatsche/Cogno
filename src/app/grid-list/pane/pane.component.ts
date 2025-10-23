import {AfterViewInit, Component, ElementRef, Input, ViewChild} from '@angular/core';
import {ShellConfigPosition} from "../../config/+models/config";
import {TerminalComponentFactory} from "./+state/terminal-component.factory";
import {TerminalId} from "../+model/model";

@Component({
  selector: 'app-pane',
  imports: [],
  templateUrl: './pane.component.html',
  styleUrl: './pane.component.scss'
})
export class PaneComponent implements AfterViewInit {
    @Input({ required: true }) terminalId!: TerminalId;
    @ViewChild('dock', { static: true }) hostRef!: ElementRef<HTMLDivElement>;

    constructor(private terminalComponents: TerminalComponentFactory) {}

    ngAfterViewInit() {
        this.terminalComponents.attach(this.terminalId, this.hostRef.nativeElement);
    }
}

