import {ShellType} from "../../config/+models/config";
import {BehaviorSubject, debounceTime, Observable, skip} from 'rxjs';
import {AppBus} from "../../app-bus/app-bus";
import {
    INITIAL_STATE,
    TerminalCursorPosition,
    TerminalDimensions,
    TerminalInput,
    TerminalMousePosition,
    TerminalState
} from "./terminal.state";
import {Command} from "./command.model";

export class TerminalStateManager {
    private _stateSubject: BehaviorSubject<TerminalState>;
    private _historySubject: BehaviorSubject<Command[]>;

    constructor(
        terminalId: string,
        shellType: ShellType,
        private _bus: AppBus
    ) {
        this._stateSubject = new BehaviorSubject<TerminalState>({...INITIAL_STATE, terminalId, shellType});
        this._historySubject = new BehaviorSubject<Command[]>([]);
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
        console.log("#####Starte Command!");
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
        if ( this.commands.find(c => c.id === id)) {
            return;
        }
        const commands = [...this.commands];
        
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
        console.log('####push', command);
        commands.push(command);
        this._historySubject.next(commands);
    }

    updateCommands(commands: Command[]) {
        this._historySubject.next(commands);
    }

    updateCwd(cwd: string) {
        this._stateSubject.next({...this._stateSubject.value, cwd});
    }
}
