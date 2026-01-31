import {Component, input} from '@angular/core';

@Component({
  selector: 'app-pane-header',
  standalone: true,
  template: `
    <div class="pane-header">
      <span class="cwd">{{cwd()}}</span>
    </div>
  `,
  styles: `
    .pane-header {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2px 8px;
      background: transparent;
    }

    .cwd {
      font-family: var(--font-family);
      font-size: calc(var(--font-size));
      color: var(--foreground-color);
      opacity: 0.7;
      text-align: center;
    }
  `
})
export class PaneHeaderComponent {
  cwd = input.required<string>();
}
