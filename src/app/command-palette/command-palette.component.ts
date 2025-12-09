import {
    Component,
    computed,
    effect,
    signal,
    viewChild,
    DestroyRef,
    ElementRef, Signal, WritableSignal
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {CommandEntry, CommandPaletteService} from './command-palette.service';
import {ActionKeybindingPipe} from "../keybinding/pipe/keybinding.pipe";

@Component({
    selector: 'app-command-palette',
    standalone: true,
    imports: [CommonModule, ActionKeybindingPipe],
    template: `
        @if (visible()) {
            <div class="container" (click)="close($event)">
                <div class="base-overlay" >
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
                                        <span class="keybinding">{{command.action.actionName | actionkeybinding}}</span>
                                    </li>
                                }
                            </ul>
                        } @else {
                            <div class="no-results">No matches</div>
                        }
                </div>
            </div>
        }
        
    `,
    styles: [
        `
            .container {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 1000;
            }
            
            .base-overlay {
                left: 50%;
                position: absolute;
                transform: translateX(-50%);
                margin-top: 3rem;
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                min-width: 300px;
            }

            .search-input {
                padding: 6px 8px;
                border-radius: 6px;
                border: 1px solid rgba(255, 255, 255, 0.12);
                background: rgba(255, 255, 255, 0.04);
                color: inherit;
                outline: none;
            }

            .command-list {
                list-style: none;
                margin: 0;
                padding: 0;
                max-height: 240px;
                overflow: auto;
            }

            .command {
                display: flex;
                flex-direction: row;
                align-items: center;
                justify-content: space-between;
                padding: 8px 10px;
                gap: 1rem;
                cursor: default;
                
                &:hover {
                    background: var(--background-color-30l);
                    outline: none;
                }
                
                &.selected {
                    background: var(--background-color-20l);
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
export class CommandPaletteComponent {
    visible: Signal<boolean>;
    commandList: Signal<CommandEntry[]>;
    private inputElement = viewChild<ElementRef<HTMLInputElement>>('inputElement');
    private commandListElement = viewChild<ElementRef<HTMLUListElement>>('commandListElement');

    constructor(private service: CommandPaletteService) {
        // Register Escape listener to close palette while it's mounted
        this.visible = this.service.isVisible;
        this.commandList = this.service.filteredCommandList;

        effect(() => {
            const input = this.inputElement()?.nativeElement;
            if (this.visible() && input) {
                input.value = '';
                this.service.filterCommands('');
                input.focus();
            }
        });
        effect(() => {
            // Track changes in visibility and command list
            const visible = this.visible();
            const list = this.commandList();
            if (!visible || !list?.length) return;

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

    onQuery(event: Event) {
        const value = (event.target as HTMLInputElement).value;
        this.service.filterCommands(value);
    }

    close(event: Event): void {
        event.stopPropagation();
        event.preventDefault();
        this.service.close();
    }

    fireAction(command: CommandEntry|undefined = undefined) {
        this.service.fireAction(command);
    }
}
