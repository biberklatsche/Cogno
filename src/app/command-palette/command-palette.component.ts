import { Component, afterNextRender, computed, output, signal, viewChild, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppBus } from '../app-bus/app-bus';
import { ActionFired, ActionName } from '../action/action.models';
import { KeybindService } from '../keybinding/keybind.service';
import { CommandPaletteService } from './command-palette.service';
import { ActionDefinition } from '../keybinding/keybind-action.interpreter';

// Use shared ActionDefinition to avoid type duplication

@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cp-container">
      <input
        type="text"
        #inputEl
        [value]="query()"
        (input)="onQuery($event)"
        (keydown.enter)="selectFirst()"
        placeholder="Type a command…"
        class="cp-input"
      />

      @if (filtered().length > 0) {
        <ul class="cp-list">
          @for (a of filtered(); track a.actionName) {
            <li (click)="select(a)" class="cp-item">
              {{ toLabel(a.actionName) }}
            </li>
          }
        </ul>
      } @else {
        <div class="cp-no-results">No matches</div>
      }
    </div>
  `,
  styles: [
    `
      .cp-container {
        display: flex;
        flex-direction: column;
        min-width: 280px;
        gap: 6px;
      }
      .cp-input {
        width: 100%;
        padding: 6px 8px;
        border-radius: 6px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.04);
        color: inherit;
        outline: none;
      }
      .cp-list {
        list-style: none;
        margin: 0;
        padding: 0;
        max-height: 240px;
        overflow: auto;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 6px;
      }
      .cp-item {
        padding: 8px 10px;
        cursor: pointer;
      }
      .cp-item:hover { background: rgba(255,255,255,0.06); }
      .cp-no-results { opacity: 0.6; font-size: 0.9em; padding: 4px 2px; }
    `,
  ],
})
export class CommandPaletteComponent {
  // Outputs as signals (Angular 17+)
  execute = output<ActionDefinition>();
  onClose = output<void>();

  query = signal('');
  private inputEl = viewChild<HTMLInputElement>('inputEl');

  constructor(private bus: AppBus, private keybinds: KeybindService, private destroy: DestroyRef, private cpService: CommandPaletteService) {
    // Focus the input after it is rendered
    afterNextRender(() => this.inputEl()?.focus());

    // Register Escape listener to close palette while it's mounted
    this.keybinds.registerListener('command-palette', ['Escape'], () => {
      this.onClose.emit();
    });
    this.destroy.onDestroy(() => this.keybinds.unregisterListener('command-palette'));
  }

  onQuery(event: Event) {
      const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
  }

  toLabel(name: ActionName): string {
    return name.replaceAll('_', ' ');
  }

  private normalized(s: string): string {
    return s.toLowerCase().replaceAll('_', ' ').trim();
  }

  filtered = computed(() => {
    const q = this.normalized(this.query());
    const list = this.cpService.actions();
    if (!q) return list;
    return list.filter((a) => this.normalized(a.actionName).includes(q));
  });

  selectFirst() {
    const first = this.filtered()[0];
    if (first) this.select(first);
  }

  select(actionDef: ActionDefinition) {
    // Publish via AppBus
    this.bus.publish(
      ActionFired.create(actionDef.actionName, actionDef.trigger, actionDef.args)
    );
    this.execute.emit(actionDef);
    this.onClose.emit();
  }

  trackByName = (_: number, a: ActionDefinition) => a.actionName;
}
