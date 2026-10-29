import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  untracked,
  ViewEncapsulation,
} from "@angular/core";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { Chunk, getChunks, MergeView, unifiedMergeView } from "@codemirror/merge";
import { EditorState, Extension, Text } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { GitDiffContent } from "../git-diff.service";
import { GitDiffLanguageLoader } from "../git-diff-languages";
import { GitDiffMode } from "../git-view-state.service";

const cognoTheme = EditorView.theme(
  {
    "&": {
      fontSize: "12px",
      fontFamily: "var(--font-mono, monospace)",
      background: "var(--background-color)",
      color: "var(--foreground-color)",
    },
    ".cm-content": { caretColor: "var(--foreground-color)" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--foreground-color)" },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection":
      {
        background:
          "color-mix(in srgb, var(--highlight-color) var(--menu-opacity-ct2), transparent)",
      },
    ".cm-gutters": {
      background:
        "color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-1)), var(--background-color))",
      color: "color-mix(in srgb, var(--foreground-color) var(--opacity-subtle), transparent)",
      border: "none",
      minWidth: "40px",
    },
    ".cm-activeLineGutter": {
      background:
        "color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color))",
    },
    ".cm-activeLine": {
      background:
        "color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-1)), var(--background-color))",
    },
  },
  { dark: true },
);

const cognoHighlightStyle = HighlightStyle.define([
  {
    tag: [tags.keyword, tags.controlKeyword, tags.definitionKeyword, tags.moduleKeyword],
    color: "var(--color-magenta)",
  },
  { tag: [tags.string, tags.character, tags.docString], color: "var(--color-green)" },
  {
    tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment],
    color: "color-mix(in srgb, var(--foreground-color) var(--opacity-subtle), transparent)",
    fontStyle: "italic",
  },
  { tag: [tags.number, tags.integer, tags.float], color: "var(--color-cyan)" },
  { tag: [tags.bool, tags.null, tags.atom, tags.self], color: "var(--color-magenta)" },
  { tag: [tags.typeName, tags.className, tags.namespace], color: "var(--color-blue)" },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    color: "var(--color-yellow)",
  },
  { tag: tags.propertyName, color: "var(--color-cyan)" },
  { tag: tags.regexp, color: "var(--color-red)" },
  { tag: tags.escape, color: "var(--color-cyan)" },
  {
    tag: [
      tags.heading,
      tags.heading1,
      tags.heading2,
      tags.heading3,
      tags.heading4,
      tags.heading5,
      tags.heading6,
    ],
    color: "var(--highlight-color)",
    fontWeight: "bold",
  },
  { tag: tags.strong, fontWeight: "bold" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: [tags.link, tags.url], color: "var(--color-blue)", textDecoration: "underline" },
  { tag: tags.invalid, color: "var(--color-red)", textDecoration: "underline wavy" },
  {
    tag: tags.meta,
    color: "color-mix(in srgb, var(--foreground-color) var(--opacity-subtle), transparent)",
  },
]);

async function buildExtensions(language: GitDiffLanguageLoader | undefined): Promise<Extension[]> {
  const lang = (await language?.()) ?? null;
  return [
    EditorState.readOnly.of(true),
    cognoTheme,
    syntaxHighlighting(cognoHighlightStyle),
    lineNumbers(),
    ...(lang ? [lang] : []),
  ];
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/** Keep the two panes of a split view at the same scroll offset. Returns the undo. */
function syncScroll(scrollA: HTMLElement, scrollB: HTMLElement): () => void {
  let syncingA = false;
  let syncingB = false;

  const onScrollA = () => {
    if (syncingA) {
      syncingA = false;
      return;
    }
    if (Math.abs(scrollB.scrollTop - scrollA.scrollTop) < 1) return;
    syncingB = true;
    scrollB.scrollTop = scrollA.scrollTop;
  };

  const onScrollB = () => {
    if (syncingB) {
      syncingB = false;
      return;
    }
    if (Math.abs(scrollA.scrollTop - scrollB.scrollTop) < 1) return;
    syncingA = true;
    scrollA.scrollTop = scrollB.scrollTop;
  };

  scrollA.addEventListener("scroll", onScrollA, { passive: true });
  scrollB.addEventListener("scroll", onScrollB, { passive: true });
  return () => {
    scrollA.removeEventListener("scroll", onScrollA);
    scrollB.removeEventListener("scroll", onScrollB);
  };
}

/** Marks on the right edge where the changes are, relative to the new text. */
function buildRuler(ruler: HTMLElement, chunks: readonly Chunk[], docB: Text): void {
  ruler.innerHTML = "";
  if (!chunks.length) return;

  const totalLines = docB.lines;

  const fragment = document.createDocumentFragment();
  for (const chunk of chunks) {
    const isDeletion = chunk.toB === chunk.fromB;
    const fromLine = docB.lineAt(chunk.fromB).number - 1;
    const toLine = isDeletion ? fromLine : docB.lineAt(Math.min(chunk.toB, docB.length)).number - 1;
    const lineSpan = isDeletion ? 1 : Math.max(toLine - fromLine + 1, 1);

    const mark = document.createElement("div");
    mark.className = `ruler-mark ${isDeletion ? "ruler-mark-delete" : "ruler-mark-change"}`;
    mark.style.top = `${(fromLine / totalLines) * 100}%`;
    mark.style.height = `${Math.max((lineSpan / totalLines) * 100, 0.5)}%`;
    fragment.appendChild(mark);
  }
  ruler.appendChild(fragment);
}

/**
 * Build the editor for `diff` into `host` once the language is loaded and the
 * host has had a frame to take its size. Returns the teardown, or nothing when
 * `stale()` says the inputs changed while loading.
 */
async function buildEditor(
  host: HTMLElement,
  ruler: HTMLElement,
  diff: GitDiffContent,
  mode: GitDiffMode,
  stale: () => boolean,
): Promise<(() => void) | undefined> {
  const { original, modified, language } = diff;
  const [extensions] = await Promise.all([buildExtensions(language), nextFrame()]);
  if (stale()) return undefined;

  if (mode === "unified") {
    // One editor on the new text; removed lines are shown inline above their replacement.
    const view = new EditorView({
      parent: host,
      doc: modified,
      extensions: [
        ...extensions,
        unifiedMergeView({ original, mergeControls: false, highlightChanges: true, gutter: true }),
      ],
    });
    buildRuler(ruler, getChunks(view.state)?.chunks ?? [], view.state.doc);
    return () => view.destroy();
  }

  const mergeView = new MergeView({
    parent: host,
    orientation: "a-b",
    highlightChanges: true,
    gutter: true,
    a: { doc: original, extensions },
    b: { doc: modified, extensions },
  });
  const stopScrollSync = syncScroll(mergeView.a.scrollDOM, mergeView.b.scrollDOM);
  buildRuler(ruler, mergeView.chunks, mergeView.b.state.doc);
  return () => {
    stopScrollSync();
    mergeView.destroy();
  };
}

@Component({
  selector: "app-git-diff-view",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <div #editorHost class="diff-host"></div>
    <div #ruler class="change-ruler" aria-hidden="true"></div>
  `,
  styles: [
    `
      app-git-diff-view {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
      }

      app-git-diff-view .diff-host {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }

      app-git-diff-view .cm-mergeView {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      app-git-diff-view .cm-mergeViewEditors {
        flex: 1;
        display: flex;
        min-height: 0;
      }

      app-git-diff-view .cm-mergeViewEditor {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
        min-height: 0;
      }

      app-git-diff-view .diff-host > .cm-editor {
        flex: 1;
        min-height: 0;
      }

      app-git-diff-view .cm-editor {
        flex: 1 !important;
        min-height: 0 !important;
      }

      app-git-diff-view .cm-scroller {
        overflow: auto !important;
        min-height: 0;
      }

      app-git-diff-view .cm-deletedChunk {
        background: color-mix(in srgb, var(--color-red) var(--menu-opacity-ct2), transparent);
      }

      app-git-diff-view .cm-changedLine {
        background: color-mix(in srgb, var(--color-green) var(--menu-opacity-ct2), transparent);
      }

      app-git-diff-view .cm-deletedText {
        background: var(--color-red);
        opacity: 0.5;
      }

      app-git-diff-view .cm-changedText {
        background: var(--color-green);
        opacity: 0.5;
      }

      app-git-diff-view .change-ruler {
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        width: 6px;
        pointer-events: none;
        z-index: 10;
        overflow: hidden;
      }

      app-git-diff-view .change-ruler .ruler-mark {
        position: absolute;
        left: 1px;
        right: 1px;
        min-height: 2px;
        border-radius: 1px;
        opacity: 0.75;
      }

      app-git-diff-view .change-ruler .ruler-mark-change {
        background: var(--color-green);
      }

      app-git-diff-view .change-ruler .ruler-mark-delete {
        background: var(--color-red);
      }
    `,
  ],
})
export class GitDiffViewComponent {
  readonly diff = input.required<GitDiffContent>();
  readonly mode = input<GitDiffMode>("split");

  constructor(element: ElementRef<HTMLElement>) {
    // One editor per (diff, mode); the cleanup tears down the last one and
    // cancels a build still waiting for its language.
    effect((onCleanup) => {
      const diff = this.diff();
      const mode = this.mode();
      const host = element.nativeElement.querySelector<HTMLElement>(".diff-host");
      const ruler = element.nativeElement.querySelector<HTMLElement>(".change-ruler");
      if (!host || !ruler) return;

      let stale = false;
      let teardown: (() => void) | undefined;
      untracked(() => {
        void buildEditor(host, ruler, diff, mode, () => stale).then((result) => {
          if (stale) result?.();
          else teardown = result;
        });
      });
      onCleanup(() => {
        stale = true;
        teardown?.();
        host.innerHTML = "";
        ruler.innerHTML = "";
      });
    });
  }
}
