import { signal } from "@angular/core";
import { toggled } from "./git-format";

/**
 * Rows marked with Cmd-click (Ctrl-click off macOS, where Ctrl-click is the
 * context menu) and Shift-click, for one action on all of them. A plain click
 * clears the marks; it shows the row's commit instead.
 */
export class GitRowMarks {
  readonly names = signal<ReadonlySet<string>>(new Set());
  /** The row a Shift-click range starts at: the one clicked last. */
  private anchor: string | null = null;

  /** Handles a click on `name` among `rows`; true when it marked instead of being a plain click. */
  click(event: MouseEvent, name: string, rows: ReadonlyArray<string>): boolean {
    if (event.shiftKey) {
      this.names.set(new Set([...this.names(), ...this.range(name, rows)]));
      return true;
    }
    this.anchor = name;
    if (event.metaKey || event.ctrlKey) {
      this.names.update((names) => toggled(names, name));
      return true;
    }
    this.clear();
    return false;
  }

  clear(): void {
    this.names.set(new Set());
  }

  /** Drops the marks of rows no longer listed, so no hidden row is acted on. */
  retain(rows: ReadonlyArray<string>): void {
    const listed = new Set(rows);
    const kept = [...this.names()].filter((name) => listed.has(name));
    if (kept.length !== this.names().size) this.names.set(new Set(kept));
  }

  /** From the anchor to `name` in list order, or `name` alone without an anchor in the list. */
  private range(name: string, rows: ReadonlyArray<string>): ReadonlyArray<string> {
    const from = this.anchor === null ? -1 : rows.indexOf(this.anchor);
    const to = rows.indexOf(name);
    if (from === -1 || to === -1) return [name];
    return rows.slice(Math.min(from, to), Math.max(from, to) + 1);
  }
}
