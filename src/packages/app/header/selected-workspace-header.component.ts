import { ChangeDetectionStrategy, Component, DestroyRef, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { AppBus } from "../app-bus/app-bus";
import { SelectedWorkspacePayload } from "@cogno/features/side-menu/workspace/+bus/events";
import {TooltipDirective} from "@cogno/core-ui";

@Component({
  selector: "app-selected-workspace-header",
  standalone: true,
  template: `
    @if (selectedWorkspace(); as selectedWorkspaceEntry) {
      <div
          class="selected-workspace-header"
          [style.color]="selectedWorkspaceEntry.color ? 'var(--color-' + selectedWorkspaceEntry.color + ')' : 'var(--foreground-color)'"
          [appTooltip]="selectedWorkspaceEntry.name"
      >
        <span class="selected-workspace-header__label">
          {{ selectedWorkspaceEntry.name }}
        </span>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        flex: 0 1 auto;
        justify-content: flex-end;
        min-width: 0;
        width: fit-content;
        max-width: 100%;
        margin-left: auto;
      }

      .selected-workspace-header {
        display: inline-flex;
        align-items: center;
        width: fit-content;
        max-width: 100%;
        font-size: 0.9rem;
        font-weight: 600;
        line-height: 1.2;
        min-height: 100%;
        padding: 0.15rem 0.75rem 0;
        box-sizing: border-box;
      }

      .selected-workspace-header__label {
        display: block;
        max-width: 15ch;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TooltipDirective
  ]
})
export class SelectedWorkspaceHeaderComponent {
  protected readonly selectedWorkspace = signal<SelectedWorkspacePayload | undefined>(undefined);

  constructor(
    private readonly appBus: AppBus,
    destroyRef: DestroyRef,
  ) {
    this.appBus
      .onType$("SelectedWorkspaceChanged")
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((selectedWorkspaceChangedEvent) => {
        this.selectedWorkspace.set(selectedWorkspaceChangedEvent.payload);
      });
  }
}
