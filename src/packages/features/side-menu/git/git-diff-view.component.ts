import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  ViewEncapsulation,
  viewChild,
} from "@angular/core";
import { HighlightStyle, LanguageSupport, syntaxHighlighting } from "@codemirror/language";
import { MergeView } from "@codemirror/merge";
import { EditorState, Extension } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { GitDiffContent } from "./git-diff.service";

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
      { background: "var(--highlight-color-ct2)" },
    ".cm-gutters": {
      background: "var(--background-color-10l)",
      color: "var(--foreground-color-10t)",
      border: "none",
      minWidth: "40px",
    },
    ".cm-activeLineGutter": { background: "var(--background-color-20l)" },
    ".cm-activeLine": { background: "var(--background-color-10l)" },
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
    color: "var(--foreground-color-10t)",
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
  { tag: tags.meta, color: "var(--foreground-color-10t)" },
]);

const LANGUAGE_IMPORTS: Record<string, () => Promise<LanguageSupport>> = {
  typescript: () =>
    import("@codemirror/lang-javascript").then((m) => m.javascript({ typescript: true })),
  javascript: () => import("@codemirror/lang-javascript").then((m) => m.javascript()),
  python: () => import("@codemirror/lang-python").then((m) => m.python()),
  rust: () => import("@codemirror/lang-rust").then((m) => m.rust()),
  cpp: () => import("@codemirror/lang-cpp").then((m) => m.cpp()),
  java: () => import("@codemirror/lang-java").then((m) => m.java()),
  json: () => import("@codemirror/lang-json").then((m) => m.json()),
  html: () => import("@codemirror/lang-html").then((m) => m.html()),
  css: () => import("@codemirror/lang-css").then((m) => m.css()),
  go: () => import("@codemirror/lang-go").then((m) => m.go()),
  scss: () => import("@codemirror/lang-sass").then((m) => m.sass()),
  yaml: () => import("@codemirror/lang-yaml").then((m) => m.yaml()),
  markdown: () => import("@codemirror/lang-markdown").then((m) => m.markdown()),
  sql: () => import("@codemirror/lang-sql").then((m) => m.sql()),
};

async function buildExtensions(language: string): Promise<Extension[]> {
  const lang = (await LANGUAGE_IMPORTS[language]?.()) ?? null;
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

      app-git-diff-view .cm-editor {
        flex: 1 !important;
        min-height: 0 !important;
      }

      app-git-diff-view .cm-scroller {
        overflow: auto !important;
        min-height: 0;
      }

      app-git-diff-view .cm-deletedChunk {
        background: var(--color-red-ct2);
      }

      app-git-diff-view .cm-changedLine {
        background: var(--color-green-ct2);
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
export class GitDiffViewComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() diff: GitDiffContent | null = null;

  private readonly editorHost = viewChild<ElementRef<HTMLElement>>("editorHost");
  private readonly ruler = viewChild<ElementRef<HTMLElement>>("ruler");
  private mergeView: MergeView | null = null;
  private buildTimer: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;
  private unsubscribeScrollSync: (() => void) | null = null;

  ngAfterViewInit(): void {
    this.scheduleBuild();
  }

  ngOnChanges(): void {
    this.scheduleBuild();
  }

  ngOnDestroy(): void {
    if (this.buildTimer !== null) clearTimeout(this.buildTimer);
    this.generation++;
    this.destroyMergeView();
  }

  private scheduleBuild(): void {
    if (this.buildTimer !== null) clearTimeout(this.buildTimer);
    this.generation++;
    const gen = this.generation;
    this.destroyMergeView();

    this.buildTimer = setTimeout(() => {
      this.buildTimer = null;
      void this.build(gen);
    }, 0);
  }

  private async build(gen: number): Promise<void> {
    const host = this.editorHost()?.nativeElement;
    if (!host || !this.diff || this.generation !== gen) return;

    const { original, modified, language } = this.diff;
    const [extensions] = await Promise.all([buildExtensions(language), nextFrame()]);
    if (this.generation !== gen) return;
    this.mergeView = new MergeView({
      parent: host,
      orientation: "a-b",
      highlightChanges: true,
      gutter: true,
      a: { doc: original, extensions },
      b: { doc: modified, extensions },
    });
    this.setupScrollSync();
    this.buildRuler();
  }

  private setupScrollSync(): void {
    if (!this.mergeView) return;

    const scrollA = this.mergeView.a.scrollDOM;
    const scrollB = this.mergeView.b.scrollDOM;
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

    this.unsubscribeScrollSync = () => {
      scrollA.removeEventListener("scroll", onScrollA);
      scrollB.removeEventListener("scroll", onScrollB);
    };
  }

  private buildRuler(): void {
    const ruler = this.ruler()?.nativeElement;
    if (!ruler || !this.mergeView) return;

    ruler.innerHTML = "";
    const chunks = this.mergeView.chunks;
    if (!chunks.length) return;

    const docB = this.mergeView.b.state.doc;
    const totalLines = docB.lines;

    const fragment = document.createDocumentFragment();
    for (const chunk of chunks) {
      const isDeletion = chunk.toB === chunk.fromB;
      const fromLine = docB.lineAt(chunk.fromB).number - 1;
      const toLine = isDeletion
        ? fromLine
        : docB.lineAt(Math.min(chunk.toB, docB.length)).number - 1;
      const lineSpan = isDeletion ? 1 : Math.max(toLine - fromLine + 1, 1);

      const mark = document.createElement("div");
      mark.className = `ruler-mark ${isDeletion ? "ruler-mark-delete" : "ruler-mark-change"}`;
      mark.style.top = `${(fromLine / totalLines) * 100}%`;
      mark.style.height = `${Math.max((lineSpan / totalLines) * 100, 0.5)}%`;
      fragment.appendChild(mark);
    }
    ruler.appendChild(fragment);
  }

  private destroyMergeView(): void {
    this.unsubscribeScrollSync?.();
    this.unsubscribeScrollSync = null;
    this.mergeView?.destroy();
    this.mergeView = null;
    const host = this.editorHost()?.nativeElement;
    if (host) host.innerHTML = "";
    const ruler = this.ruler()?.nativeElement;
    if (ruler) ruler.innerHTML = "";
  }
}
