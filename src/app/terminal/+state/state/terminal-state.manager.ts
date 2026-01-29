import {ShellType} from "../../../config/+models/config";
import {debounceTime, skip} from 'rxjs';
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
import {Injectable, signal, WritableSignal, Signal, computed} from "@angular/core";
import {toObservable} from "@angular/core/rxjs-interop";
import {TerminalId} from '../../../grid-list/+model/model';

@Injectable()
export class TerminalStateManager {
    private readonly _stateSubject: WritableSignal<TerminalState>;
    private readonly _historySubject: WritableSignal<Command[]>;

    constructor(
        private _bus: AppBus
    ) {
        this._stateSubject = signal<TerminalState>(INITIAL_STATE);
        this._historySubject = signal<Command[]>([]);
        
        toObservable(this._stateSubject).pipe(
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

    initialize(terminalId: string, shellType: ShellType): void {
        this._stateSubject.update(s => ({...s, terminalId, shellType}));
    }

    private updateState(updates: Partial<TerminalState>): void {
        this._stateSubject.update(s => ({
            ...s,
            ...updates
        }));
    }

    get state(): Signal<TerminalState> {
        return this._stateSubject.asReadonly();
    }

    get cursorPosition(): Signal<TerminalCursorPosition> {
        return computed(() => this._stateSubject().cursorPosition);
    }
    updateCursorPosition(position: TerminalCursorPosition): void {
        this.updateState({ cursorPosition: position });
    }

    get mousePosition(): Signal<TerminalMousePosition> {
        return computed(() => this._stateSubject().mousePosition);
    }
    updateMousePosition(position: TerminalMousePosition): void {
        this.updateState({ mousePosition: position });
    }

    get dimensions(): Signal<TerminalDimensions> {
        return computed(() => this._stateSubject().dimensions);
    }
    updateDimensions(dimensions: TerminalDimensions): void {
        this.updateState({ dimensions: dimensions });
    }

    get isFocused(): Signal<boolean> {
        return computed(() => this._stateSubject().isFocused);
    }
    setFocus(focused: boolean): void {
        this.updateState({ isFocused: focused });
    }

    get isCommandRunning(): Signal<boolean> {
        return computed(() => this._stateSubject().isCommandRunning);
    }
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
        const startTime = this._stateSubject().commandStartTime;
        return startTime !== undefined ? Date.now() - startTime : undefined;
    }

    get input(): Signal<TerminalInput> {
        return computed(() => this._stateSubject().input);
    }
    updateInput(input: TerminalInput): void {
        this.updateState({ input: input });
    }

    get terminalId(): Signal<TerminalId> {
        return computed(() => this._stateSubject().terminalId);
    }
    get shellType(): Signal<ShellType | undefined> {
        return computed(() => this._stateSubject().shellType);
    }

    get commands(): Signal<Command[]> {
        return this._historySubject.asReadonly();
    }

    updateCommandList(data: Record<string, string>): void {
        const id = data['id'];
        const directory = data['directory'];
        const user = data['user'];
        const machine = data['machine'];

        // Check if command already exists
        if ( this._historySubject().find(c => c.id === id)) {
            return;
        }
        const commands = [...this._historySubject()];
        
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
        this._historySubject.set(commands);
    }

    updateCommands(commands: Command[]) {
        this._historySubject.set(commands);
    }

    updateCwd(cwd: string) {
        this._stateSubject.update(s => ({...s, cwd}));
    }
}
