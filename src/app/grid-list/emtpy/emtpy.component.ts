import { Component } from '@angular/core';
import {ActionKeybindingPipe} from "../../keybinding/pipe/keybinding.pipe";

@Component({
  selector: 'app-emtpy',
    imports: [
        ActionKeybindingPipe
    ],
  template: `
      <div class="actions">
          <span class="name">New Tab</span>
          <span class="keybinding">{{ 'new_tab' | actionkeybinding }}</span>
          <span class="name">New Window</span>
          <span class="keybinding">{{ 'new_window' | actionkeybinding }}</span>
      </div>
  `,
  styles: [`
      :host {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
      }
      .actions {
          display: grid;
          grid-template-columns: max-content max-content;
          gap: 1rem;
      }
      .name {
          color: var(--foreground-color);
          opacity: 0.6;
      }
    .keybinding {
        color: var(--foreground-color);
        opacity: 0.4;
    }
  `]
})
export class EmtpyComponent {



    constructor() { }
}
