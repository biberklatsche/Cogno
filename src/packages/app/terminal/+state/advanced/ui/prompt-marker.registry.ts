import { IDisposable } from "@cogno/core-support";
import { IBuffer, IMarker, Terminal } from "@xterm/xterm";

export type PromptMarker = {
  commandId: string;
  marker: IMarker;
};

const PROMPT_MARKER_ID_REGEX = /^\^\^#(\d+)/;

function isPromptMarkerLine(lineText: string): boolean {
  return /^\^\^#\d+/.test(lineText);
}

/**
 * The marker of the current prompt always sits close to the buffer end, so
 * callers on hot paths must cap the scan — an unbounded scan walks the whole
 * scrollback (default 100k lines) when no marker line matches.
 */
function findLastPromptMarkerLine(
  buffer: {
    length: number;
    getLine(y: number): { translateToString(): string } | undefined;
  },
  maxScanLines: number,
): number {
  const lowestLineIndex = Math.max(0, buffer.length - maxScanLines);
  for (let lineIndex = buffer.length - 1; lineIndex >= lowestLineIndex; lineIndex--) {
    const line = buffer.getLine(lineIndex);
    if (line && isPromptMarkerLine(line.translateToString())) return lineIndex;
  }
  return -1;
}

/** How far above the cursor a freshly printed marker line is searched. */
const ANCHOR_SCAN_WINDOW_LINES = 50;
/** How many parsed writes may pass before a pending anchor request is dropped. */
const MAX_ANCHOR_ATTEMPTS = 40;
/** Cap for the text-scan fallback when no anchored marker is available. */
const FALLBACK_SCAN_WINDOW_LINES = 500;
/** How far around a stale marker its line is searched again after a reflow. */
const RESYNC_SCAN_WINDOW_LINES = 200;

/**
 * Tracks the buffer line of every `^^#<id>` prompt marker through xterm
 * `IMarker`s so hot paths (each keystroke, each render tick) can look marker
 * positions up in O(1)/O(markers) instead of scanning buffer text.
 *
 * Anchoring is driven by the OSC 733 prompt sequence: the shell emits it right
 * before PS1 prints the marker line, so `expectMarker()` arms a bounded
 * backward scan that runs on the next parsed writes until the new line is
 * found. xterm keeps marker lines up to date across scrolling and trimming;
 * reflow bookkeeping has historically been unreliable, so `resync()` re-anchors
 * stale markers after a resize.
 */
export class PromptMarkerRegistry implements IDisposable {
  private _terminal?: Terminal;
  private _markers: PromptMarker[] = [];
  private readonly _registeredCommandIds = new Set<string>();
  private _pendingAnchorAttempts = 0;

  setTerminal(terminal: Terminal): void {
    this._terminal = terminal;
  }

  /** Arm anchoring for the marker line the shell is about to print. */
  expectMarker(): void {
    this._pendingAnchorAttempts = MAX_ANCHOR_ATTEMPTS;
  }

  /** Cheap no-op unless a marker is expected; call on every parsed write. */
  onWriteParsed(): void {
    if (this._pendingAnchorAttempts <= 0) return;
    this._pendingAnchorAttempts--;
    if (this.anchorNewMarkers()) {
      this._pendingAnchorAttempts = 0;
    }
  }

  /** All live markers in buffer-line order (oldest first). */
  get markers(): readonly PromptMarker[] {
    this.pruneDisposedMarkers();
    return this._markers;
  }

  /**
   * Line of the current prompt's marker. Falls back to a capped text scan when
   * nothing is anchored (e.g. integration output predating this registry).
   */
  lastMarkerLine(): number {
    const buffer = this._terminal?.buffer?.active;
    if (!buffer) return -1;
    // A freshly printed marker line may not be anchored yet: xterm fires the
    // cursor-move events of a chunk before onWriteParsed, so readers on those
    // events would otherwise compute against the previous prompt's marker.
    if (this._pendingAnchorAttempts > 0 && this.anchorNewMarkers()) {
      this._pendingAnchorAttempts = 0;
    }
    this.pruneDisposedMarkers();
    const last = this._markers[this._markers.length - 1];
    if (last) return last.marker.line;
    return findLastPromptMarkerLine(buffer, FALLBACK_SCAN_WINDOW_LINES);
  }

  /**
   * Validate every marker against its buffer line and re-anchor markers that a
   * reflow has shifted away from their `^^#<id>` text. Only called on resize.
   */
  resync(): void {
    this.validateRange(0, Number.MAX_SAFE_INTEGER);
  }

  /**
   * Validate the markers within `[lowestLine, highestLine]` against their
   * buffer lines. Screen-rewriting sequences (`clear`, TUI redraws, deleted
   * lines) blank a marker's line without xterm disposing the marker — such
   * stale markers are re-anchored to their relocated `^^#<id>` text or
   * dropped when the text is gone.
   */
  validateRange(lowestLine: number, highestLine: number): void {
    const terminal = this._terminal;
    const buffer = terminal?.buffer?.active;
    if (!terminal || !buffer || buffer.type === "alternate") return;
    this.pruneDisposedMarkers();

    for (const entry of [...this._markers]) {
      if (entry.marker.line < lowestLine || entry.marker.line > highestLine) continue;
      const expectedPrefix = `^^#${entry.commandId}`;
      const lineText = buffer.getLine(entry.marker.line)?.translateToString() ?? "";
      if (lineText.startsWith(expectedPrefix)) continue;

      const relocatedLine = this.findLineNear(buffer, entry.marker.line, expectedPrefix);
      this.removeEntry(entry);
      entry.marker.dispose();
      if (relocatedLine >= 0) {
        this.registerMarkerAtLine(relocatedLine, entry.commandId);
      }
    }
    this._markers.sort((a, b) => a.marker.line - b.marker.line);
  }

  dispose(): void {
    for (const entry of this._markers) {
      entry.marker.dispose();
    }
    this._markers = [];
    this._registeredCommandIds.clear();
    this._pendingAnchorAttempts = 0;
    this._terminal = undefined;
  }

  /** Scan the lines just written for new `^^#<id>` markers and anchor them. */
  private anchorNewMarkers(): boolean {
    const terminal = this._terminal;
    const buffer = terminal?.buffer?.active;
    if (!terminal || !buffer || buffer.type === "alternate") return false;
    this.pruneDisposedMarkers();

    const cursorLine = buffer.baseY + buffer.cursorY;
    const lastAnchoredLine = this._markers[this._markers.length - 1]?.marker.line ?? -1;
    const lowestLine = Math.max(lastAnchoredLine + 1, cursorLine - ANCHOR_SCAN_WINDOW_LINES, 0);

    let anchored = false;
    for (let lineIndex = lowestLine; lineIndex <= cursorLine; lineIndex++) {
      const lineText = buffer.getLine(lineIndex)?.translateToString();
      const commandId = lineText?.match(PROMPT_MARKER_ID_REGEX)?.[1];
      if (!commandId || this._registeredCommandIds.has(commandId)) continue;
      anchored = this.registerMarkerAtLine(lineIndex, commandId) || anchored;
    }
    return anchored;
  }

  private registerMarkerAtLine(lineIndex: number, commandId: string): boolean {
    const terminal = this._terminal;
    const buffer = terminal?.buffer?.active;
    if (!terminal || !buffer) return false;

    const cursorLine = buffer.baseY + buffer.cursorY;
    const marker = terminal.registerMarker(lineIndex - cursorLine);
    if (!marker) return false;

    const entry: PromptMarker = { commandId, marker };
    marker.onDispose(() => this.removeEntry(entry));
    this._markers.push(entry);
    this._registeredCommandIds.add(commandId);
    return true;
  }

  private findLineNear(buffer: IBuffer, aroundLine: number, expectedPrefix: string): number {
    const lowestLine = Math.max(0, aroundLine - RESYNC_SCAN_WINDOW_LINES);
    const highestLine = Math.min(buffer.length - 1, aroundLine + RESYNC_SCAN_WINDOW_LINES);
    for (let offset = 0; offset <= highestLine - lowestLine; offset++) {
      for (const lineIndex of [aroundLine - offset, aroundLine + offset]) {
        if (lineIndex < lowestLine || lineIndex > highestLine) continue;
        const lineText = buffer.getLine(lineIndex)?.translateToString();
        if (lineText?.startsWith(expectedPrefix)) return lineIndex;
      }
    }
    return -1;
  }

  private removeEntry(entry: PromptMarker): void {
    const index = this._markers.indexOf(entry);
    if (index >= 0) this._markers.splice(index, 1);
    this._registeredCommandIds.delete(entry.commandId);
  }

  /** Safety net for markers disposed without their onDispose having run yet. */
  private pruneDisposedMarkers(): void {
    for (let index = this._markers.length - 1; index >= 0; index--) {
      const entry = this._markers[index];
      if (!entry.marker.isDisposed) continue;
      this._markers.splice(index, 1);
      this._registeredCommandIds.delete(entry.commandId);
    }
  }
}
