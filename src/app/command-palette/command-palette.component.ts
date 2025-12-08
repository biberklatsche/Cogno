import {
    Component,
    afterNextRender,
    computed,
    output,
    effect,
    signal,
    viewChild,
    DestroyRef,
    AfterViewInit, ElementRef, Signal
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {AppBus} from '../app-bus/app-bus';
import {ActionFired, ActionName} from '../action/action.models';
import {KeybindService} from '../keybinding/keybind.service';
import {CommandEntry, CommandPaletteService} from './command-palette.service';
import {ActionDefinition} from '../keybinding/keybind-action.interpreter';
import {ActionKeybindingPipe} from "../keybinding/pipe/keybinding.pipe";
import {event} from "@tauri-apps/api";

// Use shared ActionDefinition to avoid type duplication

@Component({
    selector: 'app-command-palette',
    standalone: true,
    imports: [CommonModule, ActionKeybindingPipe],
    template: `
        <div class="container" [class.hidden]="!visible()" (click)="close($event)">
            <div class="base-overlay" >
                <input
                        autocomplete="off"
                        type="text"
                        #inputElement
                        (input)="onQuery($event)"
                        (click)="$event.stopPropagation()"
                        (keydown.enter)="selectFirst()"
                        placeholder="Type a command…"
                        class="search-input"
                />

                @if(visible()){
                    @if (filtered().length > 0) {
                        <ul class="command-list">
                            @for (a of filtered(); track a.label) {
                                <li (click)="select(a)" class="command">
                                    <span class="label">{{ a.label }}</span>
                                    <span class="keybinding">{{a.action.actionName | actionkeybinding}}</span>
                                </li>
                            }
                        </ul>
                    } @else {
                        <div class="no-results">No matches</div>
                    }
                }
            </div>
        </div>
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
                gap: 6px;
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
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 6px;
            }

            .command {
                display: flex;
                flex-direction: row;
                align-items: center;
                justify-content: space-between;
                padding: 8px 10px;
                cursor: default;
            }

            .command:hover {
                background: var(--background-color-20l);
                outline: none;
            }

            .no-results {
                opacity: 0.6;
                font-size: 0.9em;
                padding: 4px 2px;
            }
            
            .hidden {
                z-index: -1;
                transform: translateX(-100000px);
            }
        `,
    ],
})
export class CommandPaletteComponent {
    query = signal('');
    visible: Signal<boolean>;
    private inputElement = viewChild<ElementRef<HTMLInputElement>>('inputElement');

    constructor(private keybinds: KeybindService, private destroy: DestroyRef, private service: CommandPaletteService) {
        // Register Escape listener to close palette while it's mounted
        this.visible = this.service.visible;
        this.keybinds.registerListener('command-palette', ['Escape'], () => {
            this.service.close();
        });
        this.destroy.onDestroy(() => this.keybinds.unregisterListener('command-palette'));
        effect(() => {
            if(this.visible() && this.inputElement()?.nativeElement) {
                this.inputElement()!.nativeElement.value = '';
                this.inputElement()!.nativeElement.focus()
            }
        })
    }

    onQuery(event: Event) {
        const value = (event.target as HTMLInputElement).value;
        this.query.set(value);
    }

    private normalized(s: string): string {
        return s.toLowerCase().replaceAll('_', ' ').trim();
    }

    filtered = computed(() => {
        const q = this.normalized(this.query());
        const list = this.service.actions();
        if (!q) return list;
        return list.filter((a) => a.label.includes(q));
    });

    selectFirst() {
        const first = this.filtered()[0];
        if (first) this.select(first);
    }

    select(command: CommandEntry) {
        this.service.fire(command.action);
    }

    close(event: Event): void {
        event.stopPropagation();
        event.preventDefault();
        this.service.close();
    }
}
