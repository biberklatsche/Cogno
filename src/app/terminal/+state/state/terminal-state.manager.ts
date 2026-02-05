import {ShellType} from "../../../config/+models/config";
import {BehaviorSubject, debounceTime, map, Observable, skip} from 'rxjs';
import {AppBus} from "../../../app-bus/app-bus";
import {
    INITIAL_STATE,
    TerminalCursorPosition,
    TerminalDimensions,
    TerminalInput,
    TerminalMousePosition,
    TerminalState
} from "./terminal.state";
import {Command} from "./command.model";
import {Injectable} from "@angular/core";
import {TerminalId} from '../../../grid-list/+model/model';

@Injectable()
export class TerminalStateManager {
    private readonly _stateSubject: BehaviorSubject<TerminalState>;
    private readonly _historySubject: BehaviorSubject<Command[]>;

    constructor(
        private _bus: AppBus
    ) {
        this._stateSubject = new BehaviorSubject<TerminalState>(INITIAL_STATE);
        this._historySubject = new BehaviorSubject<Command[]>([]);
        
        this._stateSubject.pipe(
            skip(1), // Initialen State ignorieren
            debounceTime(10) // Damit multiple Änderungen in einem Frame zusammengefasst werden
        ).subscribe((state) => {
            this._bus.publish({
                path: ['inspector'],
                type: 'Inspector',
                payload: { type: 'terminal-state', data: {...state} }
            });
        });

        this._historySubject.pipe(
            skip(1),
            debounceTime(10)
        ).subscribe((history) => {
            this._bus.publish({
                path: ['inspector'],
                type: 'Inspector',
                payload: {
                    type: 'terminal-history',
                    data: {
                        terminalId: this._stateSubject.value.terminalId,
                        commands: history
                    }
                }
            });
        });
    }

    initialize(terminalId: string, shellType: ShellType): void {
        this.updateState({terminalId, shellType});
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
        this.updateState({ dimensions: dimensions });
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
        return this._stateSubject.pipe(map(s => s.isCommandRunning))
    }

    startCommand(): void {
        const currentInput = this._stateSubject.value.input;
        const commands = [...this._historySubject.value];
        if (commands.length > 0) {
            const lastCommand = commands[commands.length - 1];
            lastCommand.set('command', currentInput.text.trim());
            this._historySubject.next(commands);
        }
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

    get input(): TerminalInput {
        return this._stateSubject.value.input;
    }

    get input$(): Observable<TerminalInput> {
        return this._stateSubject.pipe(map(s => s.input));
    }

    updateInput(input: TerminalInput): void {
        this.updateState({ input: input });
    }

    get terminalId(): TerminalId {
        return this._stateSubject.value.terminalId;
    }

    get shellType(): ShellType | undefined {
        return this._stateSubject.value.shellType;
    }

    get commands(): Command[] {
        return this._historySubject.value;
    }

    get commands$(): Observable<Command[]> {
        return this._historySubject.asObservable();
    }

    updateCommandList(data: Record<string, string>): void {
        const id = data['id'];
        const directory = data['directory'];
        const user = data['user'];
        const machine = data['machine'];

        // Check if command already exists
        if ( this._historySubject.value.find(c => c.id === id)) {
            return;
        }
        const commands = [...this._historySubject.value];
        
        // Update previous command if exists
        if (commands.length > 0) {
            const updateData = {...data};
            delete updateData['id'];
            delete updateData['directory'];
            delete updateData['user'];
            delete updateData['machine'];
            const lastCommand = commands[commands.length - 1];
            lastCommand.setData(data);
        }
        const command = new Command(id, directory, machine, user);
        commands.push(command);
        this._historySubject.next(commands);
    }

    updateCommands(commands: Command[]) {
        this._historySubject.next(commands);
    }

    updateCwd(cwd: string) {
        this.updateState({cwd});
        this._bus.publish({
            path: ['app', 'terminal', this._stateSubject.value.terminalId],
            payload: {cwd: this._stateSubject.value.cwd, terminalId: this._stateSubject.value.terminalId},
            type: 'TerminalCwdChanged'
        });
    }
}
