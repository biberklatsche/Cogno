import {ShellType} from "../../config/+models/config";
import {BehaviorSubject, debounceTime, Observable, skip} from 'rxjs';
import {AppBus} from "../../app-bus/app-bus";
import {TerminalCursorPosition, TerminalDimensions, TerminalInput, TerminalMousePosition, TerminalState} from "./terminal.state";
import {CommandHistory} from "./command-history";
import {Command} from "./command.model";

export class TerminalStateManager {
    private _stateSubject: BehaviorSubject<TerminalState>;

    constructor(
        terminalId: string,
        shellType: ShellType,
        private _bus: AppBus
    ) {
        this._stateSubject = new BehaviorSubject<TerminalState>({
            terminalId,
            shellType,
            commandHistory: new CommandHistory(),
            cursorPosition: {
                viewport: {col: 1, row: 1},
                col: 1, row: 1,
                char: ''
            },
            mousePosition: {
                viewport: {col: 1, row: 1},
                col: 1, row: 1,
                char: ''
            },
            dimensions: { rows: 0, cols: 0, cellHeight: 0, cellWidth: 0 },
            isFocused: false,
            isCommandRunning: false,
            commandStartTime: undefined,
            input: {cursorIndex: 0, maxCursorIndex: 0, text: ''}
        });

        this._stateSubject.pipe(
            skip(1), // Initialen State ignorieren
            debounceTime(0) // Damit multiple Änderungen in einem Frame zusammengefasst werden
        ).subscribe((state) => {
            this._bus.publish({
                path: ['inspector'],
                type: 'Inspector',
                payload: { type: 'terminal-state', data: {...state} }
            });
        });
    }

    private updateState(updates: Partial<TerminalState>): void {
        this._stateSubject.next({
            ...this._stateSubject.value,
            ...updates
        });
    }

    get state$(): Observable<TerminalState> {
        return this._stateSubject.asObservable();
    }

    get state(): TerminalState {
        return this._stateSubject.value;
    }

    get cursorPosition() { return this._stateSubject.value.cursorPosition; }
    updateCursorPosition(position: TerminalCursorPosition): void {
        this.updateState({ cursorPosition: position });
    }

    get mousePosition() { return this._stateSubject.value.mousePosition; }
    updateMousePosition(position: TerminalMousePosition): void {
        this.updateState({ mousePosition: position });
    }

    get dimensions() { return this._stateSubject.value.dimensions; }
    updateDimensions(dimensions: TerminalDimensions): void {
        this.updateState({ dimensions: dimensions });
    }

    get isFocused() { return this._stateSubject.value.isFocused; }
    setFocus(focused: boolean): void {
        this.updateState({ isFocused: focused });
    }

    get isCommandRunning() { return this._stateSubject.value.isCommandRunning; }
    startCommand(): void {
        this.updateState({
            isCommandRunning: true,
            commandStartTime: Date.now(),
            input: { text: '', maxCursorIndex: 0, cursorIndex: 0 }
        });
    }

    endCommand(): void {
        this.updateState({
            isCommandRunning: false
        });
    }

    getCommandDuration(): number | undefined {
        const startTime = this._stateSubject.value.commandStartTime;
        return startTime !== undefined ? Date.now() - startTime : undefined;
    }

    get input(): TerminalInput { return this._stateSubject.value.input; }
    updateInput(input: TerminalInput): void {
        this.updateState({ input: input });
    }

    get terminalId() { return this._stateSubject.value.terminalId; }
    get shellType() { return this._stateSubject.value.shellType; }

    get commands(): readonly Command[] {
        return this._stateSubject.value.commandHistory.getCommands();
    }

    updateCommandList(data: Record<string, string>): void {
        const id = data['id'];
        const directory = data['directory'];
        const user = data['user'];
        const machine = data['machine'];
        
        const commandHistory = this._stateSubject.value.commandHistory;
        
        // Check if command already exists
        if (commandHistory.findById(id)) {
            return;
        }
        
        // Update previous command if exists
        if (commandHistory.getCommands().length > 0) {
            const updateData = {...data};
            delete updateData['id'];
            delete updateData['directory'];
            delete updateData['user'];
            delete updateData['machine'];
            commandHistory.updateLastCommand(updateData);
        }
        
        // Add new command
        commandHistory.addCommand(id, directory, machine, user);
        
        // Trigger state update
        this.updateState({ 
            commandHistory: commandHistory 
        });
    }
}
