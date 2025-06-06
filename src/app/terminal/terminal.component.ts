// src/app/terminal/terminal.component.ts
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import {spawn} from "tauri-pty";

@Component({
  selector: 'app-terminal',
  templateUrl: './terminal.component.html',
  styleUrls: ['./terminal.component.scss'],
  standalone: true
})
export class TerminalComponent implements AfterViewInit, OnDestroy {
  @ViewChild('terminalContainer', { static: true }) terminalContainer!: ElementRef<HTMLDivElement>;

  private term!: Terminal;
  private fitAddon = new FitAddon();

  // ID des Subskriptions-Events, um es bei ngOnDestroy abzubestellen
  private stdoutUnlisten: () => void;
  private exitUnlisten: () => void;

  constructor() {
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

    const pty = spawn("zsh", [/* args */], {
      cols: this.term.cols,
      rows: this.term.rows,
    })

    pty.onData(data => this.term.write(data))
    this.term.onData(data => pty.write(data))
  }

  ngOnDestroy(): void {
    // Event-Listener säubern
    this.stdoutUnlisten();
    this.exitUnlisten();
    // Terminal schliessen
    this.term.dispose();
  }
}
