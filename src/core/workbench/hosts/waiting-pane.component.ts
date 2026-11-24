import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from "@angular/core";
import { ConnectFailure, isWorthRetrying } from "./remote-hosts.service";

/** Why a pane of another machine shows no terminal (yet). */
export type WaitingPaneState =
  /** The machine is being connected. */
  | { readonly status: "connecting" }
  /** The machine is asked for the pane's shell. */
  | { readonly status: "lookingForShell" }
  /** The machine could not be connected. */
  | { readonly status: "connectFailed"; readonly failure: ConnectFailure }
  /** The machine is connected but did not say whether the shell runs. */
  | { readonly status: "noAnswer"; readonly message: string }
  /** The machine answered: the pane's shell does not run there any more. */
  | { readonly status: "shellGone" };

/** Whether trying again could get the pane its shell. */
function canRetry(state: WaitingPaneState): boolean {
  switch (state.status) {
    case "connectFailed":
      return isWorthRetrying(state.failure);
    case "noAnswer":
      return true;
    default:
      return false;
  }
}

/**
 * What a pane shows instead of a terminal while the machine its shell runs
 * on is not connected yet, while it is asked for the shell, or when the
 * shell is not there.
 */
@Component({
  selector: "app-waiting-pane",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (state; as state) {
      @switch (state.status) {
        @case ("connecting") {
          <div class="waiting-title">Connecting to {{ host }}…</div>
        }
        @case ("lookingForShell") {
          <div class="waiting-title">Looking for the shell on {{ host }}…</div>
        }
        @case ("connectFailed") {
          <div class="waiting-title">Could not connect to {{ host }}</div>
          <div class="waiting-reason">{{ state.failure.message }}</div>
        }
        @case ("noAnswer") {
          <div class="waiting-title">{{ host }} did not say whether the shell runs</div>
          <div class="waiting-reason">{{ state.message }}</div>
        }
        @case ("shellGone") {
          <div class="waiting-title">The shell no longer runs on {{ host }}</div>
        }
      }
      @if (state.status !== "connecting" && state.status !== "lookingForShell") {
        <div class="waiting-actions">
          @if (retryable(state)) {
            <button type="button" class="button" (click)="retry.emit()">Retry</button>
          }
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
    .waiting-title {
      font-weight: 600;
    }
    .waiting-reason {
      opacity: 0.8;
      font-family: monospace;
      font-size: 0.85rem;
      max-width: 80%;
      text-align: center;
      white-space: pre-wrap;
    }
    .waiting-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }
  `,
})
export class WaitingPaneComponent {
  @Input({ required: true }) host!: string;
  @Input({ required: true }) state!: WaitingPaneState;
  @Output() readonly retry = new EventEmitter<void>();
  @Output() readonly closePane = new EventEmitter<void>();

  protected retryable(state: WaitingPaneState): boolean {
    return canRetry(state);
  }
}
