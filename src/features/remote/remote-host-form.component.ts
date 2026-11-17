import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  signal,
} from "@angular/core";
import { RemoteHost } from "@cogno/core/api/remote-shells-port";
import { RemotePanelService } from "./remote-panel.service";

type FormValues = { name: string; destination: string; command: string };

/**
 * Adds a remote reached over ssh, or changes a remote (`host`). The command
 * ssh runs there is advanced: Cogno finds it by itself when the remote names
 * none. A paired machine has only its name to change: how it is reached
 * comes from the pairing.
 */
@Component({
  selector: "app-remote-host-form",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="host-form" (submit)="save($event)">
      <label>
        <span>Name</span>
        <input
          type="text"
          spellcheck="false"
          autocomplete="off"
          placeholder="office"
          [value]="values().name"
          [disabled]="saving()"
          (input)="setField('name', $event)"
        />
      </label>
      @if (!isPaired()) {
        <label>
          <span>Destination</span>
          <input
            type="text"
            spellcheck="false"
            autocomplete="off"
            placeholder="user@host or an ssh alias"
            [value]="values().destination"
            [disabled]="saving()"
            (input)="setField('destination', $event)"
          />
        </label>
        <details class="advanced" [open]="hasCommand()">
          <summary>Advanced</summary>
          <label>
            <span>Command ssh runs there</span>
            <input
              type="text"
              spellcheck="false"
              autocomplete="off"
              placeholder="Found by itself"
              [value]="values().command"
              [disabled]="saving()"
              (input)="setField('command', $event)"
            />
          </label>
        </details>
      }
      @if (error(); as error) {
        <div class="failure">{{ error }}</div>
      }
      <div class="form-actions">
        <button type="button" class="button" [disabled]="saving()" (click)="closed.emit()">
          Cancel
        </button>
        <button type="submit" class="button" [disabled]="saving()">Save</button>
      </div>
    </form>
  `,
  styles: `
    .host-form {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-bottom: 8px;
      margin-bottom: 6px;
      border-bottom: 1px solid color-mix(in srgb, var(--foreground-color) 15%, transparent);
    }

    label {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    label span,
    summary {
      font-size: 0.85rem;
      opacity: 0.7;
    }

    summary {
      cursor: pointer;
      margin-bottom: 4px;
    }

    input {
      min-width: 0;
      background: var(--background-color);
      color: var(--foreground-color);
      border: 1px solid color-mix(in srgb, var(--foreground-color) 20%, transparent);
      border-radius: var(--button-border-radius);
      padding: 0.3rem 0.4rem;
      font: inherit;
    }

    input:focus {
      outline: none;
      border-color: var(--highlight-color);
    }

    .failure {
      color: var(--color-red);
      font-size: 0.9rem;
      overflow-wrap: anywhere;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 6px;
    }
  `,
})
export class RemoteHostFormComponent implements OnChanges {
  /** The remote to change; left out to add one. */
  @Input() host?: RemoteHost;
  /** Saved or cancelled. */
  @Output() readonly closed = new EventEmitter<void>();

  readonly values = signal<FormValues>({ name: "", destination: "", command: "" });
  readonly saving = signal(false);
  readonly error = signal<string | undefined>(undefined);

  constructor(private readonly panel: RemotePanelService) {}

  /** The panel may switch the form to another remote while it is open. */
  ngOnChanges(): void {
    this.error.set(undefined);
    const ssh = this.host?.kind === "ssh" ? this.host : undefined;
    this.values.set({
      name: this.host?.name ?? "",
      destination: ssh?.destination ?? "",
      command: ssh?.command ?? "",
    });
  }

  protected isPaired(): boolean {
    return this.host?.kind === "paired";
  }

  protected hasCommand(): boolean {
    return this.host?.kind === "ssh" && !!this.host.command;
  }

  setField(field: keyof FormValues, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.values.update((values) => ({ ...values, [field]: value }));
    this.error.set(undefined);
  }

  async save(event: Event): Promise<void> {
    event.preventDefault();
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(undefined);
    const { name, destination, command } = this.values();
    const error =
      this.host?.kind === "paired"
        ? await this.panel.renamePairedHost(this.host.name, name)
        : await this.panel.saveHost(
            { name, destination, command: command.trim() || undefined },
            this.host?.name,
          );
    this.saving.set(false);
    if (error === undefined) {
      this.closed.emit();
    } else {
      this.error.set(error);
    }
  }
}
