import {
  Directive,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from "@angular/core";

@Directive({
  selector: "[appTooltip]",
  standalone: true,
})
export class TooltipDirective implements OnChanges, OnDestroy {
  @Input("appTooltip") text = "";
  @Input("appTooltipSecondary") secondaryText: string | undefined = undefined;
  @Input() tooltipDelay = 800;
  /**
   * Programmatic visibility, independent of hover: true shows the tooltip (after
   * tooltipManualDelay, so rapid keyboard navigation doesn't flicker), false hides it
   * again. Leave undefined for pure hover behavior.
   */
  @Input() tooltipVisible: boolean | undefined = undefined;
  @Input() tooltipManualDelay = 150;

  private tooltipElement?: HTMLElement;
  private showTimeout?: ReturnType<typeof setTimeout>;

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (!("tooltipVisible" in changes)) return;
    clearTimeout(this.showTimeout);
    if (this.tooltipVisible) {
      this.showTimeout = setTimeout(() => {
        this.showTooltip();
      }, this.tooltipManualDelay);
    } else {
      this.removeTooltip();
    }
  }

  @HostListener("mouseenter")
  onMouseEnter(): void {
    // While manual visibility governs (or the tooltip is already shown), the
    // hover timer must not compete with the manual timer for the single
    // showTimeout handle — an overwritten manual timer would be orphaned and
    // fire even after tooltipVisible flipped back to false.
    if (this.tooltipElement || this.tooltipVisible) return;
    clearTimeout(this.showTimeout);
    this.showTimeout = setTimeout(() => {
      this.showTooltip();
    }, this.tooltipDelay);
  }

  @HostListener("mouseleave")
  onMouseLeave(): void {
    if (this.tooltipVisible) return;
    clearTimeout(this.showTimeout);
    this.removeTooltip();
  }

  ngOnDestroy(): void {
    clearTimeout(this.showTimeout);
    this.removeTooltip();
  }

  private showTooltip(): void {
    this.removeTooltip();
    if (!this.text) return;

    this.tooltipElement = document.createElement("div");
    const textElement = document.createElement("span");
    textElement.innerText = this.text;
    this.tooltipElement.appendChild(textElement);

    if (this.secondaryText) {
      const secondaryTextElement = document.createElement("span");
      secondaryTextElement.style.opacity = "0.5";
      secondaryTextElement.innerText = this.secondaryText;
      this.tooltipElement.appendChild(secondaryTextElement);
    }

    this.tooltipElement.style.display = "flex";
    this.tooltipElement.style.flexDirection = "row";
    this.tooltipElement.style.gap = "1rem";
    this.tooltipElement.style.position = "fixed";
    this.tooltipElement.style.padding = "3px 10px";
    this.tooltipElement.style.background =
      "color-mix(in srgb, var(--background-color) var(--menu-opacity-ct), transparent)";
    this.tooltipElement.style.color = "var(--foreground-color)";
    this.tooltipElement.style.borderRadius = "4px";
    this.tooltipElement.style.fontSize = "1rem";
    this.tooltipElement.style.zIndex = "9999";
    this.tooltipElement.style.pointerEvents = "none";
    this.tooltipElement.style.whiteSpace = "pre-wrap";
    this.tooltipElement.style.overflowWrap = "anywhere";
    this.tooltipElement.style.maxWidth = "calc(100vw - 24px)";
    this.tooltipElement.style.transition = "opacity 120ms ease";
    this.tooltipElement.style.opacity = "0";

    document.body.appendChild(this.tooltipElement);
    this.positionTooltip();

    requestAnimationFrame(() => {
      if (this.tooltipElement) this.tooltipElement.style.opacity = "1";
    });
  }

  private positionTooltip(): void {
    if (!this.tooltipElement) return;

    const hostRect = this.host.nativeElement.getBoundingClientRect();
    const tooltipRect = this.tooltipElement.getBoundingClientRect();
    const margin = 6;

    let top = hostRect.bottom + margin;
    if (top + tooltipRect.height > window.innerHeight) {
      top = hostRect.top - tooltipRect.height - margin;
    }

    let left = hostRect.left + (hostRect.width - tooltipRect.width) / 2;
    if (left < 0) left = margin;
    if (left + tooltipRect.width > window.innerWidth) {
      left = window.innerWidth - tooltipRect.width - margin;
    }

    this.tooltipElement.style.top = `${top}px`;
    this.tooltipElement.style.left = `${left}px`;
  }

  private removeTooltip(): void {
    if (this.tooltipElement) {
      this.tooltipElement.remove();
      this.tooltipElement = undefined;
    }
  }
}
