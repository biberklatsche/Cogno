import {Component} from '@angular/core';

@Component({
  selector: 'app-workspace-side',
  standalone: true,
  template: `
    <section class="workspace-side">
      <h3>Workspace</h3>
      <p>Dies ist eine Beispiel-Komponente für den Workspace.</p>
      <ul>
        <li>Info 1</li>
        <li>Info 2</li>
        <li>Info 3</li>
      </ul>
    </section>
  `,
  styles: [`
    .workspace-side {
      padding: 12px;
      color: var(--foreground-color);
    }
    h3 { margin: 0 0 8px 0; }
    p { margin: 0 0 12px 0; opacity: .8; }
  `]
})
export class WorkspaceSideComponent {}
