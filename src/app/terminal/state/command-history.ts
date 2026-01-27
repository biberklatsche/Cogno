import {Command} from './command.model';

export class CommandHistory {
    private commands: Command[] = [];

    addCommand(id: string, directory: string, machine: string, user: string): void {
        const command = new Command(id, directory, machine, user);
        this.commands.push(command);
    }

    updateLastCommand(data: Record<string, string>): void {
        if (this.commands.length === 0) return;
        const lastCommand = this.commands[this.commands.length - 1];
        lastCommand.setData(data);
    }

    getCommands(): readonly Command[] {
        return this.commands;
    }

    getLastCommand(): Command | undefined {
        return this.commands[this.commands.length - 1];
    }

    findById(id: string): Command | undefined {
        return this.commands.find(c => c.id === id);
    }
}
