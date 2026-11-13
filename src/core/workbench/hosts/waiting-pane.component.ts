import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

/** Why a pane of another machine shows no terminal (yet). */
export type HostConnectionState =
  /** The machine is being connected. */
  | { readonly status: "connecting" }
  /** The machine is asked what runs there now. */
  | { readonly status: "looking" }
  /** The machine could not be reached, or did not answer. */
  | { readonly status: "unreachable"; readonly reason: string }
  /** The machine answered: the pane's shell does not run there any more. */
  | { readonly status: "gone" };

/**
 * What a pane shows instead of a terminal while the machine its shell runs
 * on is not connected yet, or the shell is not there.
 */
@Component({
  selector: "app-host-connection",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (state(); as state) {
      @if (state.status === "connecting") {
        <div class="host-connection-title">Connecting to {{ host() }}…</div>
      } @else if (state.status === "looking") {
        <div class="host-connection-title">Looking for the shell on {{ host() }}…</div>
      } @else {
        @if (state.status === "unreachable") {
          <div class="host-connection-title">Could not connect to {{ host() }}</div>
          <div class="host-connection-reason">{{ state.reason }}</div>
        } @else {
          <div class="host-connection-title">The shell no longer runs on {{ host() }}</div>
        }
        <div class="host-connection-actions">
          <button type="button" class="button" (click)="retry.emit()">Retry</button>
          <button type="button" class="button" (click)="closePane.emit()">Close</button>
        </div>
      }
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      width: 100%;
      height: 100%;
      background: var(--background-color);
      color: var(--foreground-color);
    }
    .host-connection-title {
      font-weight: 600;
    }
    .host-connection-reason {
      opacity: 0.8;
      font-family: monospace;
      font-size: 0.85rem;
      max-width: 80%;
      text-align: center;
      white-space: pre-wrap;
    }
    .host-connection-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }
  `,
})
export class HostConnectionComponent {
  host = input.required<string>();
  state = input.required<HostConnectionState>();
  retry = output<void>();
  closePane = output<void>();
}
