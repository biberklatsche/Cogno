import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import {IPty, Pty} from "../_tauri/pty";

@Component({
  selector: 'app-terminal',
  templateUrl: './terminal.component.html',
  styleUrls: ['./terminal.component.css'],
  standalone: true,
  providers: [Pty]
})
export class TerminalComponent implements AfterViewInit, OnDestroy {
  @ViewChild('terminalContainer', { static: true }) terminalContainer!: ElementRef<HTMLDivElement>;

  private term!: Terminal;
  private pty: IPty;
  private fitAddon = new FitAddon();

  // ID des Subskriptions-Events, um es bei ngOnDestroy abzubestellen
  private stdoutUnlisten: () => void;
  private exitUnlisten: () => void;

  constructor() {
    this.pty = new Pty();
    // Platzhalter, wird in ngAfterViewInit überschrieben
    this.stdoutUnlisten = () => {};
    this.exitUnlisten = () => {};
  }

  ngAfterViewInit(): void {
    // 1) xterm initialisieren
    this.term = new Terminal({
      cursorBlink: true,
      fontFamily: 'monospace',
      fontSize: 14,
      cols: 80,
      rows: 24,
      theme: {
        background: '#1e1e1e',
        foreground: '#ffffff'
      }
    });
    this.term.loadAddon(this.fitAddon);
    this.term.open(this.terminalContainer.nativeElement);
    this.fitAddon.fit();
    this.pty.resize(this.term.cols, this.term.rows);
    this.pty.onData(data => this.term.write(data));
    this.term.onData(data => this.pty.write(data));
    this.pty.onExit(e => this.term.dispose());
  }

  ngOnDestroy(): void {
    // Event-Listener säubern
    this.stdoutUnlisten();
    this.exitUnlisten();
    // Terminal schliessen
    this.term.dispose();
  }
}
