import {Component, DestroyRef, OnDestroy, OnInit, signal, WritableSignal} from '@angular/core';
import {ConfigService} from "../../config/+state/config.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {SideMenuItemComponent} from "../../menu/side-menu/+state/side-menu.service";
import {WorkspaceService} from "../+state/workspace.service";

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
      color: var(--foreground-color);
    }
    h3 { margin: 0 0 8px 0; }
    p { margin: 0 0 12px 0; opacity: .8; }
  `]
})
export class WorkspaceSideComponent implements OnInit, OnDestroy, SideMenuItemComponent{


    constructor(private service: WorkspaceService) {
    }

    ngOnDestroy(): void {
        this.service.dispose();
    }

    ngOnInit(): void {

    }

    onSideMenuKey(event: KeyboardEvent): void {

    }
}
