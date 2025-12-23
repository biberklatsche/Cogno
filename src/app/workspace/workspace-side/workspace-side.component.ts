import {Component, DestroyRef, OnDestroy, OnInit, Signal, signal, WritableSignal} from '@angular/core';
import {ConfigService} from "../../config/+state/config.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {WorkspaceConfigUi, WorkspaceService} from "../+state/workspace.service";
import {AppBus} from "../../app-bus/app-bus";
import {KeybindService} from "../../keybinding/keybind.service";
import {WorkspaceConfig} from "../+model/workspace";

@Component({
  selector: 'app-workspace-side',
  standalone: true,
  template: `
      <section class="workspace-side">
          <ul class="workspace-grid">
              @for (workspace of workspaceList(); track workspace.name) {
                  <li class="workspace-tile" [class.selected]="workspace.isSelected">
                      <div class="workspace-tile__content">
                          <div class="workspace-badge"
                               [style.background-color]="workspace.color ? 'var(--color-' + workspace.color + ')' : undefined">
                              {{ (workspace.name || '')[0] || '?' }}
                          </div>
                          <div class="workspace-name">{{ workspace.name }}</div>
                      </div>
                  </li>
              }
          </ul>
      </section>
  `,
  styles: [`
      :host, .workspace-side {
          display: block;
      }

      .workspace-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px;
          list-style: none;
          margin: 0;
          padding: 0;
          width: min(500px, max(33vw, 300px));
      }

      .workspace-tile {
          border-radius: var(--button-border-radius);
          border: 1px solid var(--background-color-20l-ct);
          background-color: var(--background-color-20l-ct);
          opacity: 0.7;
          cursor: default;

          &:hover {
              background: var(--background-color-20l) !important;
              opacity: 1;
              outline: none;
          }

          &.selected {
              background: var(--background-color-20l);
              border: 1px solid var(--background-color-30l);
              outline: none;
              opacity: 1;
          }
      }

      /* Inhalt: Icon/Badge + Name */
      .workspace-tile__content {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 40px;
          padding: 5px 10px;
      }

      .workspace-badge {
          width: 24px;
          min-width: 24px;
          height: 24px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          line-height: 0;
          color: var(--forground-color);
      }

      .workspace-name {
          font-size: 0.95rem;
          color: var(--color-text, inherit);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
      }
  `]
})
export class WorkspaceSideComponent {

    workspaceList: Signal<WorkspaceConfigUi[]> = this.workspaceService.workspaceList;

    constructor(private workspaceService: WorkspaceService) {
    }
}
