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
import { cpp } from "@codemirror/lang-cpp";
import { css } from "@codemirror/lang-css";
import { go } from "@codemirror/lang-go";
import { html } from "@codemirror/lang-html";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { sass } from "@codemirror/lang-sass";
import { sql } from "@codemirror/lang-sql";
import { yaml } from "@codemirror/lang-yaml";
import { LanguageSupport } from "@codemirror/language";
import { MergeView } from "@codemirror/merge";
import { EditorState, Extension } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import { GitDiffContent } from "./git-diff.service";

function languageExtension(language: string): LanguageSupport | null {
  switch (language) {
    case "typescript":
      return javascript({ typescript: true });
    case "javascript":
      return javascript();
    case "python":
      return python();
    case "rust":
      return rust();
    case "cpp":
      return cpp();
    case "java":
      return java();
    case "json":
      return json();
    case "html":
      return html();
    case "css":
      return css();
    case "go":
      return go();
    case "scss":
      return sass();
    case "yaml":
      return yaml();
    case "markdown":
      return markdown();
    case "sql":
      return sql();
    default:
      return null;
  }
}

function buildExtensions(isDark: boolean, language: string): Extension[] {
  const lang = languageExtension(language);
  return [
    EditorState.readOnly.of(true),
    EditorView.theme(
      {
        "&": { fontSize: "12px", fontFamily: "var(--font-mono, monospace)" },
        ".cm-gutters": { minWidth: "40px" },
      },
      { dark: isDark },
    ),
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
  template: `<div #editorHost class="diff-host"></div>`,
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
    `,
  ],
})
export class GitDiffViewComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() diff: GitDiffContent | null = null;
  @Input() isDark = true;

  private readonly editorHost = viewChild<ElementRef<HTMLElement>>("editorHost");
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
    const extensions = buildExtensions(this.isDark, language);

    await nextFrame();
    if (this.generation !== gen) return;
    this.mergeView = new MergeView({
      parent: host,
      orientation: "a-b",
      revertControls: undefined,
      highlightChanges: true,
      gutter: true,
      a: { doc: original, extensions },
      b: { doc: modified, extensions },
    });
    this.applyLayoutStyles();
    this.setupScrollSync();
  }

  private applyLayoutStyles(): void {
    if (!this.mergeView) return;

    this.mergeView.dom.style.flex = "1";
    this.mergeView.dom.style.display = "flex";
    this.mergeView.dom.style.flexDirection = "column";
    this.mergeView.dom.style.overflow = "hidden";

    const editorsEl = this.mergeView.dom.querySelector<HTMLElement>(".cm-mergeViewEditors");
    if (editorsEl) {
      editorsEl.style.flex = "1";
      editorsEl.style.display = "flex";
      editorsEl.style.minHeight = "0";
    }

    this.mergeView.dom.querySelectorAll<HTMLElement>(".cm-mergeViewEditor").forEach((el) => {
      el.style.flex = "1";
      el.style.display = "flex";
      el.style.flexDirection = "column";
      el.style.minWidth = "0";
      el.style.minHeight = "0";
    });

    [this.mergeView.a, this.mergeView.b].forEach((view) => {
      view.dom.style.flex = "1";
      view.dom.style.minHeight = "0";
      view.scrollDOM.style.overflow = "auto";
    });
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

  private destroyMergeView(): void {
    this.unsubscribeScrollSync?.();
    this.unsubscribeScrollSync = null;
    this.mergeView?.destroy();
    this.mergeView = null;
    const host = this.editorHost()?.nativeElement;
    if (host) host.innerHTML = "";
  }
}
