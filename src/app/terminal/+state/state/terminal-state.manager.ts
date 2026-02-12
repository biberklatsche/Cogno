import { ShellType } from "../../../config/+models/config";
import { BehaviorSubject, debounceTime, map, Observable, skip } from "rxjs";
import { Injectable } from "@angular/core";

import { AppBus } from "../../../app-bus/app-bus";
import {
    INITIAL_STATE,
    TerminalCursorPosition,
    TerminalDimensions,
    TerminalInput,
    TerminalMousePosition,
    TerminalState
} from "./terminal.state";
import { Command } from "./command.model";
import { TerminalId } from "../../../grid-list/+model/model";

import { OS } from "../../../_tauri/os";
import { IPathAdapter } from "../advanced/adapter/base/path-adapter.interface";
import { PathFactory } from "../advanced/adapter/path.factory";
import { ShellContext } from "../advanced/data/models"; // nimm dein zentrales Model
import { HistoryService } from "../advanced/history/history.service"; // Pfad anpassen

@Injectable()
export class TerminalStateManager {
    private readonly _stateSubject: BehaviorSubject<TerminalState>;
    private _pathAdapter?: IPathAdapter;

    constructor(
        private _bus: AppBus,
        private _history: HistoryService
    ) {
        this._stateSubject = new BehaviorSubject<TerminalState>(INITIAL_STATE);

        // Inspector: terminal-state
        this._stateSubject
            .pipe(skip(1), debounceTime(10))
            .subscribe(state => {
                this._bus.publish({
                    path: ["inspector"],
                    type: "Inspector",
                    payload: { type: "terminal-state", data: { ...state } }
                });
            });

        // Inspector: terminal-history (kommt jetzt aus HistoryService)
        this._history.commands$
            .pipe(skip(1), debounceTime(10))
            .subscribe(history => {
                this._bus.publish({
                    path: ["inspector"],
                    type: "Inspector",
                    payload: {
                        type: "terminal-history",
                        data: {
                            terminalId: this._stateSubject.value.terminalId,
                            commands: history
                        }
                    }
                });
            });
    }

    initialize(terminalId: string, shellType: ShellType): void {
        const shellContext: ShellContext = { shellType, backendOs: OS.platform() } as ShellContext;
        this._pathAdapter = PathFactory.createAdapter(shellContext);
        this._history.initialize(shellContext, this._pathAdapter);
        this.updateState({ terminalId, shellContext });
    }

    private updateState(updates: Partial<TerminalState>): void {
        this._stateSubject.next({
            ...this._stateSubject.value,
            ...updates
        });
    }

    // ---- State getters/streams wie vorher ----

    get state$(): Observable<TerminalState> {
        return this._stateSubject.asObservable();
    }

    get state(): TerminalState {
        return this._stateSubject.value;
    }

    get cursorPosition$(): Observable<TerminalCursorPosition> {
        return this._stateSubject.pipe(map(s => s.cursorPosition));
    }

    get cursorPosition(): TerminalCursorPosition {
        return this._stateSubject.value.cursorPosition;
    }

    updateCursorPosition(position: TerminalCursorPosition): void {
        this.updateState({ cursorPosition: position });
    }

    get mousePosition(): TerminalMousePosition {
        return this._stateSubject.value.mousePosition;
    }

    updateMousePosition(position: TerminalMousePosition): void {
        this.updateState({ mousePosition: position });
    }

    get dimensions(): TerminalDimensions {
        return this._stateSubject.value.dimensions;
    }

    updateDimensions(dimensions: TerminalDimensions): void {
        this.updateState({ dimensions });
    }

    get isFocused(): boolean {
        return this._stateSubject.value.isFocused;
    }

    get isFocused$(): Observable<boolean> {
        return this._stateSubject.pipe(map(s => s.isFocused));
    }

    setFocus(focused: boolean): void {
        this.updateState({ isFocused: focused });
    }

    get isInFullScreenMode$(): Observable<boolean> {
        return this._stateSubject.pipe(map(s => s.isInFullScreenMode));
    }

    setInFullScreenMode(fullSizeMode: boolean): void {
        this.updateState({ isInFullScreenMode: fullSizeMode });
    }

    get isCommandRunning(): boolean {
        return this._stateSubject.value.isCommandRunning;
    }

    get isCommandRunning$(): Observable<boolean> {
        return this._stateSubject.pipe(map(s => s.isCommandRunning));
    }

    startCommand(): void {
        const currentInput = this._stateSubject.value.input;

        this._history.startCommand(currentInput.text);

        this.updateState({
            isCommandRunning: true,
            commandStartTime: Date.now(),
            input: { text: "", maxCursorIndex: 0, cursorIndex: 0 }
        });
    }

    endCommand(): void {
        this.updateState({ isCommandRunning: false });
        this._history.onCommandExecuted();
    }

    getCommandDuration(): number | undefined {
        const startTime = this._stateSubject.value.commandStartTime;
        return startTime !== undefined ? Date.now() - startTime : undefined;
    }

    get input(): TerminalInput {
        return this._stateSubject.value.input;
    }

    get input$(): Observable<TerminalInput> {
        return this._stateSubject.pipe(map(s => s.input));
    }

    updateInput(input: TerminalInput): void {
        this.updateState({ input });
    }

    get terminalId(): TerminalId {
        return this._stateSubject.value.terminalId;
    }

    // ---- History Zugriff jetzt über Service ----

    get commands$(): Observable<Command[]> {
        return this._history.commands$;
    }

    get commands(): Command[] {
        return this._history.commands;
    }

    updateCommandList(data: Record<string, string>): void {
        this._history.updateCommand(data);
    }

    updateCommands(commands: Command[]): void {
        this._history.updateCommands(commands);
    }

    updateCwd(cwd: string): void {
        this.updateState({ cwd });

        const normalizedPath = this._pathAdapter!.normalize(cwd);
        const backendOsPath = this._pathAdapter!.render(normalizedPath, { purpose: "backend_fs" });
        if (!backendOsPath) return;

        // Persistierung + Stats
        this._history.onCwdChanged(cwd);

        this._bus.publish({
            path: ["app", "terminal", this._stateSubject.value.terminalId],
            payload: { cwd: backendOsPath, terminalId: this._stateSubject.value.terminalId },
            type: "TerminalCwdChanged"
        });
    }
}
