import {
    Component,
    computed,
    effect,
    signal,
    viewChild,
    DestroyRef,
    ElementRef, Signal, WritableSignal, AfterViewInit, OnDestroy
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {CommandEntry, CommandPaletteService} from './command-palette.service';
import {ActionKeybindingPipe} from "../keybinding/pipe/keybinding.pipe";

@Component({
    selector: 'app-command-palette',
    standalone: true,
    imports: [CommonModule, ActionKeybindingPipe],
    template: `
        <input
                autocomplete="off"
                spellcheck="false"
                data-private="off"
                autocorrect="off"
                type="text"
                #inputElement
                (input)="onQuery($event)"
                (click)="$event.stopPropagation()"
                placeholder="Type a command…"
                class="search-input"
        />
        @if (commandList().length > 0) {
            <ul #commandListElement class="command-list">
                @for (command of commandList(); track command.label) {
                    <li (click)="fireAction(command)" class="command" [class.selected]="command.isSelected">
                        <span class="label">{{ command.label }}</span>
                        <span class="keybinding">{{ command.action.actionName | actionkeybinding }}</span>
                    </li>
                }
            </ul>
        } @else {
            <div class="no-results">No matches</div>
        }

    `,
    styles: [
        `
            :host {
                margin: 0;
                padding: 0;
                font-size: 0.9rem;
                width: 100%;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                height: 100%;
            }
            .search-input {
                padding: 6px 8px;
                border-radius: 6px;
                border: 1px solid rgba(255, 255, 255, 0.12);
                background: rgba(255, 255, 255, 0.04);
                color: inherit;
                outline: none;
                box-sizing: border-box;
                width: 100%;
                margin-bottom: 1rem;
            }

            .command-list {
                list-style: none;
                margin: 0;
                padding: 0;
                overflow: auto;
                flex: 1;
            }

            .command {
                display: flex;
                flex-direction: row;
                align-items: center;
                justify-content: space-between;
                text-transform: capitalize;
                padding: 8px 10px;
                gap: 1rem;
                cursor: default;
                opacity: 0.7;

                &:hover {
                    background: var(--background-color-20l);
                    opacity: 1;
                    outline: none;
                }

                &.selected {
                    background: var(--background-color-20l);
                    opacity: 1;
                    outline: none;
                }
            }

            .no-results {
                opacity: 0.6;
                font-size: 0.9em;
                padding: 4px 2px;
            }
        `,
    ],
})
export class CommandPaletteComponent implements AfterViewInit {
    commandList: Signal<CommandEntry[]>;
    private inputElement = viewChild<ElementRef<HTMLInputElement>>('inputElement');
    private commandListElement = viewChild<ElementRef<HTMLUListElement>>('commandListElement');

    constructor(private service: CommandPaletteService) {
        // Register Escape listener to close palette while it's mounted
        this.commandList = this.service.filteredCommandList;
        effect(() => {
            // Track changes in visibility and command list
            const list = this.commandList();
            if (!list?.length) return;
            const ul = this.commandListElement()?.nativeElement;
            if (!ul) return;
            const selectedIndex = list.findIndex(c => c.isSelected);
            if (selectedIndex < 0) return;
            const li = ul.children.item(selectedIndex) as HTMLElement | null;
            if (!li) return;
            // Scroll the selected item into view without jumping the whole list
            li.scrollIntoView({block: 'nearest'});
        });
    }

    ngAfterViewInit(): void {
        setTimeout(() => {
            this.inputElement()!.nativeElement.value = '';
            this.inputElement()!.nativeElement.focus();
        }, 10);
    }

    onQuery(event: Event) {
        const value = (event.target as HTMLInputElement).value;
        this.service.filterCommands(value);
    }

    fireAction(command: CommandEntry | undefined = undefined) {
        this.service.fireAction(command);
    }
}
