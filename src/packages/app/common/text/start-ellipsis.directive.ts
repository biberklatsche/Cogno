import { AfterViewInit, Directive, ElementRef, input, OnDestroy } from "@angular/core";

type MatchRange = { start: number; end: number };

@Directive({
  selector: "[appStartEllipsis]",
  standalone: true,
})
export class StartEllipsisDirective implements AfterViewInit, OnDestroy {
  appStartEllipsis = input<string>("");
  appStartEllipsisMatches = input<MatchRange[] | undefined>(undefined);

  private readonly prefix = "\u2026";
  private resizeObserver?: ResizeObserver;

  constructor(private readonly elementRef: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    const element = this.elementRef.nativeElement;
    this.resizeObserver = new ResizeObserver(() => this.apply());
    this.resizeObserver.observe(element);
    queueMicrotask(() => this.apply());
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  ngDoCheck(): void {
    this.apply();
  }

  private apply(): void {
    const element = this.elementRef.nativeElement;
    const fullText = this.appStartEllipsis() ?? "";
    const rawRanges = this.appStartEllipsisMatches() ?? [];
    const ranges = this.normalizeRanges(rawRanges, fullText.length);

    if (element.textContent !== fullText) {
      element.textContent = fullText;
    }

    if (element.scrollWidth <= element.clientWidth) {
      this.renderContent(element, fullText, ranges, 0);
      return;
    }

    let low = 0;
    let high = fullText.length;

    while (low < high) {
      const mid = Math.floor((low + high + 1) / 2);
      const candidate = this.prefix + fullText.slice(fullText.length - mid);
      element.textContent = candidate;
      if (element.scrollWidth <= element.clientWidth) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }

    let cutStart = fullText.length - low;
    if (this.shouldPreserveDotfile(fullText, cutStart)) {
      const candidate = this.prefix + fullText.slice(cutStart - 1);
      element.textContent = candidate;
      if (element.scrollWidth <= element.clientWidth) {
        cutStart -= 1;
      }
    }
    this.renderContent(element, fullText, ranges, cutStart);
  }

  private renderContent(
    element: HTMLElement,
    fullText: string,
    ranges: MatchRange[],
    cutStart: number,
  ): void {
    element.replaceChildren();

    if (!fullText) return;

    if (cutStart > 0) {
      element.append(document.createTextNode(this.prefix));
    }

    const visibleStart = Math.max(0, Math.min(cutStart, fullText.length));
    const visibleText = fullText.slice(visibleStart);
    if (!visibleText) return;

    const visibleRanges = this.mapRangesToVisible(ranges, visibleStart, fullText.length);
    if (visibleRanges.length === 0) {
      element.append(document.createTextNode(visibleText));
      return;
    }

    let pos = 0;
    for (const range of visibleRanges) {
      if (range.start > pos) {
        element.append(document.createTextNode(visibleText.slice(pos, range.start)));
      }
      const span = document.createElement("span");
      span.className = "match";
      this.applyHostScopeAttribute(element, span);
      span.textContent = visibleText.slice(range.start, range.end);
      element.append(span);
      pos = range.end;
    }
    if (pos < visibleText.length) {
      element.append(document.createTextNode(visibleText.slice(pos)));
    }
  }

  private mapRangesToVisible(
    ranges: MatchRange[],
    visibleStart: number,
    visibleEnd: number,
  ): MatchRange[] {
    const mapped: MatchRange[] = [];
    for (const range of ranges) {
      const start = Math.max(range.start, visibleStart);
      const end = Math.min(range.end, visibleEnd);
      if (end <= start) continue;
      mapped.push({ start: start - visibleStart, end: end - visibleStart });
    }
    return this.mergeRanges(mapped);
  }

  private normalizeRanges(ranges: MatchRange[], max: number): MatchRange[] {
    const out: MatchRange[] = [];
    for (const range of ranges) {
      const start = Math.max(0, Math.min(range.start, max));
      const end = Math.max(0, Math.min(range.end, max));
      if (end <= start) continue;
      out.push({ start, end });
    }
    return this.mergeRanges(out);
  }

  private mergeRanges(ranges: MatchRange[]): MatchRange[] {
    if (ranges.length <= 1) return ranges;
    const sorted = [...ranges].sort((a, b) => a.start - b.start);
    const merged: MatchRange[] = [];
    let current = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i];
      if (next.start <= current.end) {
        current = { start: current.start, end: Math.max(current.end, next.end) };
      } else {
        merged.push(current);
        current = next;
      }
    }
    merged.push(current);
    return merged;
  }

  private shouldPreserveDotfile(fullText: string, cutStart: number): boolean {
    return (
      cutStart > 1 &&
      fullText[cutStart - 1] === "." &&
      fullText[cutStart] !== "." &&
      (fullText[cutStart - 2] === "/" || fullText[cutStart - 2] === "\\")
    );
  }

  private applyHostScopeAttribute(host: HTMLElement, target: HTMLElement): void {
    for (const attr of host.attributes) {
      if (attr.name.startsWith("_ngcontent-")) {
        target.setAttribute(attr.name, "");
        return;
      }
    }
  }
}
